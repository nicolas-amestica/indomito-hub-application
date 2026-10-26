import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';

import type {
  ConversationDetailResponse,
  InboxMessage,
  ConversationSummary,
  SendState,
  BulkOperation,
  WhatsAppTemplate,
  MessageRichContent,
} from '../interfaces/conversation.interface';
import { InboxApiService } from '../services/inbox-api.service';
import { sha256Base64 } from '../fn/sha256-base64';
import { getInboxAttachmentMimeType } from '../fn/is-allowed-inbox-attachment';
import { isNonTerminalSend } from '../fn/is-non-terminal-send';
import { InboxRealtimeService } from '../services/inbox-realtime.service';
import type { ConversationFilter } from '../types/inbox.types';
import { buildMessageDateLabels } from '../fn/build-message-date-labels';
import { buildMessageGroupContinuations } from '../fn/build-message-group-continuations';
import { buildSafeLinkPreview } from '../fn/build-safe-link-preview';
import { classifyRealtimeSequence } from '../fn/classify-realtime-sequence';

@Injectable()
export class InboxStore {
  private readonly api = inject(InboxApiService);
  private readonly conversationState = signal<readonly ConversationSummary[]>([]);
  private readonly detailState = signal<ConversationDetailResponse | null>(null);
  private readonly selectedPhoneState = signal<string | null>(null);
  private readonly queryState = signal('');
  private readonly filterState = signal<ConversationFilter>('all');
  private readonly loadingState = signal(false);
  private readonly loadingMoreState = signal(false);
  private readonly loadingOlderState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly nextCursorState = signal<string | null>(null);
  private readonly historyCursorState = signal<string | null>(null);
  private readonly unreadTotalState = signal(0);
  private readonly optimisticMessagesState = signal<readonly InboxMessage[]>([]);
  private readonly sendingState = signal(false);
  private readonly sendStatesState = signal<readonly SendState[]>([]);
  private readonly mutatingState = signal(false);
  private readonly bulkStatesState = signal<readonly BulkOperation[]>([]);
  private readonly templatesState = signal<readonly WhatsAppTemplate[]>([]);
  private readonly realtimeConnectionState = signal<'connected' | 'reconnecting'>('connected');
  private readonly destroyRef = inject(DestroyRef);
  private readonly realtime = inject(InboxRealtimeService);
  private nextPage = 2;
  private requestSequence = 0;
  private detailRequestSequence = 0;
  private sendPollingTimer: ReturnType<typeof setTimeout> | null = null;
  private sendPollingAttempt = 0;
  private bulkPollingTimer: ReturnType<typeof setTimeout> | null = null;
  private bulkPollingAttempt = 0;
  private agentProcessingTimer: ReturnType<typeof setTimeout> | null = null;
  private listRealtimeSubscription: Subscription | null = null;
  private detailRealtimeSubscription: Subscription | null = null;
  private listSequence = 0;
  private detailSequence = 0;
  private realtimePhone: string | null = null;

  readonly conversations = this.conversationState.asReadonly();
  readonly detail = this.detailState.asReadonly();
  readonly selectedPhone = this.selectedPhoneState.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly filter = this.filterState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loadingMore = this.loadingMoreState.asReadonly();
  readonly loadingOlder = this.loadingOlderState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly unreadTotal = this.unreadTotalState.asReadonly();
  readonly sending = this.sendingState.asReadonly();
  readonly sendStates = this.sendStatesState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly bulkOperations = this.bulkStatesState.asReadonly();
  readonly templates = this.templatesState.asReadonly();
  readonly realtimeConnection = this.realtimeConnectionState.asReadonly();
  readonly agentProcessing = computed(() => this.detailState()?.conversation?.agentProcessing ?? false);
  readonly bulkOperation = computed(() =>
    this.bulkStatesState().find((operation) => operation.kind === 'mark_all_read') ?? null,
  );
  readonly messages = computed(() => [
    ...(this.detailState()?.messages ?? []),
    ...this.optimisticMessagesState(),
  ]);
  readonly messageDateLabels = computed(() => buildMessageDateLabels(this.messages()));
  readonly messageGroupContinuations = computed(() => buildMessageGroupContinuations(this.messages()));
  readonly messageLinkPreviews = computed(() => new Map(
    this.messages()
      .map((message) => [message.id, buildSafeLinkPreview(message.content)] as const)
      .filter((entry): entry is readonly [string, NonNullable<(typeof entry)[1]>] => entry[1] !== null),
  ));
  readonly hasMore = computed(() => this.nextCursorState() !== null);
  readonly hasOlderMessages = computed(() => this.historyCursorState() !== null);
  readonly visibleConversations = computed(() => {
    const conversations = this.conversationState();
    return this.filterState() === 'unread'
      ? conversations.filter((conversation) => conversation.unreadCount > 0)
      : conversations;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopSendPolling();
      this.stopBulkPolling();
      this.stopAgentProcessingTimer();
      this.listRealtimeSubscription?.unsubscribe();
      this.detailRealtimeSubscription?.unsubscribe();
    });
  }

  setQuery(value: string): void {
    this.queryState.set(value.trim().slice(0, 100));
  }

  setFilter(value: ConversationFilter): void {
    this.filterState.set(value);
  }

  async load(): Promise<void> {
    const sequence = ++this.requestSequence;
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const response = await firstValueFrom(
        this.api.list({ query: this.queryState() || undefined }),
      );
      if (sequence !== this.requestSequence) return;
      this.conversationState.set(response.data);
      this.nextCursorState.set(response.nextCursor);
      this.unreadTotalState.set(response.unreadTotal);
      this.listSequence = response.watermark.sequence;
      this.nextPage = 2;
      void this.recoverActiveBulkOperations();
      this.connectListRealtime();
    } catch {
      if (sequence === this.requestSequence) this.errorState.set('No fue posible cargar las conversaciones.');
    } finally {
      if (sequence === this.requestSequence) this.loadingState.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const cursor = this.nextCursorState();
    if (!cursor || this.loadingMoreState()) return;
    this.loadingMoreState.set(true);
    try {
      const response = await firstValueFrom(
        this.api.list({ cursor, page: this.nextPage, query: this.queryState() || undefined }),
      );
      const known = new Set(this.conversationState().map((conversation) => conversation.phone));
      this.conversationState.update((current) => [
        ...current,
        ...response.data.filter((conversation) => !known.has(conversation.phone)),
      ]);
      this.nextCursorState.set(response.nextCursor);
      this.unreadTotalState.set(response.unreadTotal);
      this.nextPage += 1;
    } catch {
      this.errorState.set('No fue posible cargar más conversaciones.');
    } finally {
      this.loadingMoreState.set(false);
    }
  }

  async select(phone: string, preserveCurrent = false): Promise<void> {
    const sequence = ++this.detailRequestSequence;
    if (this.selectedPhoneState() !== phone) {
      this.detailSequence = 0;
      this.stopAgentProcessingTimer();
    }
    this.selectedPhoneState.set(phone);
    if (!preserveCurrent) {
      this.detailState.set(null);
      this.optimisticMessagesState.set([]);
      this.historyCursorState.set(null);
    }
    this.errorState.set(null);
    try {
      const response = await firstValueFrom(this.api.detail(phone));
      if (
        sequence === this.detailRequestSequence &&
        this.selectedPhoneState() === phone &&
        response.watermark.sequence >= this.detailSequence
      ) {
        const normalized = normalizeAgentProcessing(response);
        const current = this.detailState();
        this.detailState.set(
          preserveCurrent && current
            ? mergeConversationDetail(current, normalized)
            : normalized,
        );
        if (!preserveCurrent || this.historyCursorState() === null) {
          this.historyCursorState.set(response.nextCursor);
        }
        this.sendStatesState.set(response.nonTerminalSends.filter(isNonTerminalSend));
        this.detailSequence = response.watermark.sequence;
        this.scheduleAgentProcessingExpiry(normalized.conversation);
        this.connectDetailRealtime(phone);
        this.sendPollingAttempt = 0;
        this.startSendPolling();
        if ((normalized.conversation?.unreadCount ?? 0) > 0) {
          await this.markReadAfterOpen(phone);
        }
      }
    } catch {
      if (this.selectedPhoneState() === phone) {
        this.errorState.set('No fue posible cargar el historial.');
      }
    }
  }

  clearSelection(): void {
    this.detailRequestSequence += 1;
    this.selectedPhoneState.set(null);
    this.detailState.set(null);
    this.optimisticMessagesState.set([]);
    this.sendStatesState.set([]);
    this.historyCursorState.set(null);
    this.stopAgentProcessingTimer();
    this.stopSendPolling();
    this.detailRealtimeSubscription?.unsubscribe();
    this.detailRealtimeSubscription = null;
    this.realtimePhone = null;
  }

  async loadOlderMessages(): Promise<boolean> {
    const phone = this.selectedPhoneState();
    const cursor = this.historyCursorState();
    if (!phone || !cursor || this.loadingOlderState()) return false;
    this.loadingOlderState.set(true);
    try {
      const response = await firstValueFrom(this.api.detail(phone, { before: cursor }));
      if (this.selectedPhoneState() !== phone) return false;
      const current = this.detailState();
      if (!current) return false;
      const known = new Set(current.messages.map((message) => message.id));
      this.detailState.set({
        ...current,
        messages: [
          ...response.messages.filter((message) => !known.has(message.id)),
          ...current.messages,
        ],
        hasMore: response.hasMore,
        nextCursor: response.nextCursor,
      });
      this.historyCursorState.set(response.nextCursor);
      return true;
    } catch {
      this.errorState.set('No fue posible cargar mensajes anteriores.');
      return false;
    } finally {
      this.loadingOlderState.set(false);
    }
  }

  async sendReply(content: string, replyTo: InboxMessage | null = null): Promise<boolean> {
    const phone = this.selectedPhoneState();
    const normalized = content.trim();
    if (!phone || !normalized || normalized.length > 4_096 || this.sendingState()) return false;

    const clientMessageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const optimistic: InboxMessage = {
      id: clientMessageId,
      msgSk: `LOCAL#${clientMessageId}`,
      phone,
      type: 'team',
      content: normalized,
      createdAt,
      whatsappMessageId: null,
      deliveryStatus: null,
      deliveryError: null,
      attachments: [],
      replyTo: replyTo?.whatsappMessageId ? {
        id: replyTo.id,
        type: replyTo.type,
        content: replyTo.content,
        whatsappMessageId: replyTo.whatsappMessageId,
      } : null,
    };
    this.optimisticMessagesState.update((messages) => [...messages, optimistic]);
    this.sendingState.set(true);
    this.errorState.set(null);
    try {
      const { data } = await firstValueFrom(this.api.sendReply(phone, normalized, clientMessageId, replyTo?.id));
      this.optimisticMessagesState.update((messages) =>
        messages.map((message) =>
          message.id === clientMessageId ? messageFromSendState(message, data) : message,
        ),
      );
      return data.state !== 'failed';
    } catch {
      this.optimisticMessagesState.update((messages) =>
        messages.map((message) =>
          message.id === clientMessageId
            ? { ...message, deliveryStatus: 'failed', deliveryError: 'No fue posible enviar el mensaje.' }
            : message,
        ),
      );
      return false;
    } finally {
      this.sendingState.set(false);
    }
  }

  async loadTemplates(): Promise<boolean> {
    this.errorState.set(null);
    try {
      const { data } = await firstValueFrom(this.api.listTemplates());
      this.templatesState.set(data.filter((template) => template.supported));
      return true;
    } catch {
      this.errorState.set('No fue posible cargar las plantillas aprobadas de WhatsApp.');
      return false;
    }
  }

  async sendTemplate(template: WhatsAppTemplate, parameters: readonly string[]): Promise<boolean> {
    const phone = this.selectedPhoneState();
    if (!phone || this.sendingState()) return false;
    const clientMessageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const optimistic: InboxMessage = { id: clientMessageId, msgSk: `LOCAL#${clientMessageId}`, phone, type: 'team', content: `[Plantilla] ${template.name}`, createdAt, whatsappMessageId: null, deliveryStatus: null, deliveryError: null, attachments: [], replyTo: null };
    this.optimisticMessagesState.update((messages) => [...messages, optimistic]);
    this.sendingState.set(true);
    try {
      const { data } = await firstValueFrom(this.api.sendTemplate(phone, clientMessageId, template, parameters));
      this.optimisticMessagesState.update((messages) => messages.map((message) => message.id === clientMessageId ? messageFromSendState(message, data) : message));
      return data.state !== 'failed';
    } catch {
      this.optimisticMessagesState.update((messages) => messages.map((message) => message.id === clientMessageId ? { ...message, deliveryStatus: 'failed', deliveryError: 'No fue posible enviar la plantilla.' } : message));
      return false;
    } finally { this.sendingState.set(false); }
  }

  async setReaction(message: InboxMessage, emoji: string): Promise<boolean> {
    const phone = this.selectedPhoneState();
    if (!phone || !message.whatsappMessageId || this.mutatingState()) return false;
    this.mutatingState.set(true);
    try {
      await firstValueFrom(this.api.setReaction(phone, message.id, emoji));
      const updatedAt = new Date().toISOString();
      const update = (item: InboxMessage): InboxMessage => item.id !== message.id ? item : { ...item, reactions: [...(item.reactions ?? []).filter((reaction) => reaction.actor !== 'team'), ...(emoji ? [{ emoji, actor: 'team' as const, updatedAt }] : [])] };
      this.detailState.update((detail) => detail ? { ...detail, messages: detail.messages.map(update) } : detail);
      this.optimisticMessagesState.update((messages) => messages.map(update));
      return true;
    } catch { this.errorState.set('No fue posible actualizar la reacción.'); return false; }
    finally { this.mutatingState.set(false); }
  }

  async sendRichMessage(rich: Pick<MessageRichContent, 'kind' | 'location' | 'contacts' | 'interactive'>): Promise<boolean> {
    const phone = this.selectedPhoneState();
    if (!phone || this.sendingState()) return false;
    const clientMessageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const content = rich.kind === 'location' ? `[Ubicación] ${rich.location?.name ?? ''}`.trim() : rich.kind === 'contacts' ? `[Contacto] ${rich.contacts?.[0]?.name ?? ''}`.trim() : rich.interactive?.body ?? '[Mensaje interactivo]';
    const optimistic: InboxMessage = { id: clientMessageId, msgSk: `LOCAL#${clientMessageId}`, phone, type: 'team', content, createdAt, whatsappMessageId: null, deliveryStatus: null, deliveryError: null, attachments: [], replyTo: null, rich: rich as MessageRichContent };
    this.optimisticMessagesState.update((messages) => [...messages, optimistic]);
    this.sendingState.set(true);
    this.errorState.set(null);
    try {
      const { data } = await firstValueFrom(this.api.sendRichMessage(phone, clientMessageId, rich));
      this.optimisticMessagesState.update((messages) => messages.map((message) => message.id === clientMessageId ? messageFromSendState(message, data) : message));
      return data.state !== 'failed';
    } catch {
      this.optimisticMessagesState.update((messages) => messages.map((message) => message.id === clientMessageId ? { ...message, deliveryStatus: 'failed', deliveryError: 'No fue posible enviar el mensaje enriquecido.' } : message));
      return false;
    } finally {
      this.sendingState.set(false);
    }
  }

  async sendAttachments(files: readonly File[], caption: string): Promise<boolean> {
    const phone = this.selectedPhoneState();
    if (!phone || files.length === 0 || files.length > 20 || this.sendingState()) return false;
    this.sendingState.set(true);
    this.errorState.set(null);
    try {
      const items = await Promise.all(
        files.map(async (file) => {
          const mimeType = getInboxAttachmentMimeType(file);
          if (!mimeType) throw new Error('Unsupported attachment MIME type');
          return {
            clientMessageId: crypto.randomUUID(),
            fileName: file.name,
            mimeType,
            size: file.size,
            checksumSha256: await sha256Base64(file),
          };
        }),
      );
      const batchId = crypto.randomUUID();
      const { data } = await firstValueFrom(this.api.prepareAttachments(phone, batchId, items));
      const fileById = new Map<string, File>();
      items.forEach((item, index) => {
        const file = files[index];
        if (file) fileById.set(item.clientMessageId, file);
      });
      await Promise.all(
        data.uploads.map(async (upload, index) => {
          const file = fileById.get(upload.clientMessageId);
          if (!file) throw new Error('Prepared upload does not match selected files');
          await this.api.uploadPrepared(file, upload);
          await firstValueFrom(this.api.sendAttachment(phone, upload, index === 0 ? caption.trim() : ''));
        }),
      );
      await this.select(phone, true);
      return true;
    } catch {
      this.errorState.set('No fue posible enviar los archivos adjuntos.');
      return false;
    } finally {
      this.sendingState.set(false);
    }
  }

  async sendSticker(file: File): Promise<boolean> {
    const phone = this.selectedPhoneState();
    if (!phone || file.type !== 'image/webp' || file.size < 1 || file.size > 500 * 1024 || this.sendingState()) return false;
    this.sendingState.set(true);
    this.errorState.set(null);
    try {
      const item = { clientMessageId: crypto.randomUUID(), fileName: file.name, mimeType: 'image/webp' as const, size: file.size, checksumSha256: await sha256Base64(file) };
      const { data } = await firstValueFrom(this.api.prepareAttachments(phone, crypto.randomUUID(), [item]));
      const upload = data.uploads[0];
      if (!upload) throw new Error('Sticker upload was not prepared');
      await this.api.uploadPrepared(file, upload);
      await firstValueFrom(this.api.sendAttachment(phone, upload, '', 'sticker'));
      await this.select(phone, true);
      return true;
    } catch {
      this.errorState.set('No fue posible enviar el sticker WebP.');
      return false;
    } finally {
      this.sendingState.set(false);
    }
  }

  async retrySend(clientMessageId: string): Promise<void> {
    if (this.sendingState()) return;
    this.sendingState.set(true);
    try {
      const { data } = await firstValueFrom(this.api.retrySend(clientMessageId));
      this.mergeSendState(data);
      this.startSendPolling(true);
    } catch {
      this.errorState.set('No fue posible reintentar el envío.');
    } finally {
      this.sendingState.set(false);
    }
  }

  async updateContact(name: string): Promise<boolean> {
    const phone = this.selectedPhoneState();
    const normalized = name.trim();
    if (!phone || !normalized || normalized.length > 100 || this.mutatingState()) return false;
    this.mutatingState.set(true);
    try {
      await firstValueFrom(this.api.updateContact(phone, normalized));
      this.conversationState.update((items) => items.map((item) =>
        item.phone === phone ? { ...item, alias: normalized } : item,
      ));
      this.detailState.update((detail) => detail?.conversation
        ? { ...detail, conversation: { ...detail.conversation, alias: normalized } }
        : detail);
      return true;
    } catch {
      this.errorState.set('No fue posible actualizar el alias.');
      return false;
    } finally {
      this.mutatingState.set(false);
    }
  }

  async markUnread(): Promise<void> {
    const phone = this.selectedPhoneState();
    if (!phone || this.mutatingState()) return;
    this.mutatingState.set(true);
    try {
      const wasUnread = this.conversationState().find((item) => item.phone === phone)?.unreadCount ?? 0;
      const { data } = await firstValueFrom(this.api.markUnread(phone));
      this.conversationState.update((items) => items.map((item) => item.phone === phone ? data : item));
      if (wasUnread === 0 && data.unreadCount > 0) this.unreadTotalState.update((value) => value + 1);
    } catch {
      this.errorState.set('No fue posible marcar la conversación como no leída.');
    } finally {
      this.mutatingState.set(false);
    }
  }

  private async markReadAfterOpen(phone: string): Promise<void> {
    try {
      const { data } = await firstValueFrom(this.api.markRead(phone));
      const wasUnread = this.conversationState().find((item) => item.phone === phone)?.unreadCount ?? 0;
      this.mergeConversation(data);
      if (wasUnread > 0) this.unreadTotalState.update((value) => Math.max(0, value - wasUnread));
    } catch {
      this.errorState.set('No fue posible marcar la conversación como leída.');
    }
  }

  async reactivateAgent(): Promise<boolean> {
    const phone = this.selectedPhoneState();
    if (!phone || this.mutatingState()) return false;
    this.mutatingState.set(true);
    try {
      const { data } = await firstValueFrom(this.api.reactivateAgent(phone));
      this.mergeConversation(data);
      return true;
    } catch {
      this.errorState.set('No fue posible reactivar el agente IA.');
      return false;
    } finally {
      this.mutatingState.set(false);
    }
  }

  async deleteConversation(): Promise<boolean> {
    const phone = this.selectedPhoneState();
    if (!phone || this.mutatingState()) return false;
    this.mutatingState.set(true);
    try {
      await firstValueFrom(this.api.deleteConversation(phone));
      this.conversationState.update((items) => items.filter((item) => item.phone !== phone));
      this.clearSelection();
      return true;
    } catch {
      this.errorState.set('No fue posible eliminar la conversación.');
      return false;
    } finally {
      this.mutatingState.set(false);
    }
  }

  async markAllRead(): Promise<void> {
    if (this.mutatingState()) return;
    this.mutatingState.set(true);
    try {
      const { data } = await firstValueFrom(this.api.markAllRead(crypto.randomUUID()));
      this.mergeBulkOperation(data);
      this.startBulkPolling(true);
    } catch {
      this.errorState.set('No fue posible iniciar el marcado masivo.');
    } finally {
      this.mutatingState.set(false);
    }
  }

  private startSendPolling(immediate = false): void {
    if (this.sendPollingTimer !== null) clearTimeout(this.sendPollingTimer);
    this.sendPollingTimer = null;
    const trackable = this.sendStatesState().filter((state) => state.state !== 'failed_retryable');
    if (trackable.length === 0) return;
    const oldest = Math.min(...trackable.map((state) => new Date(state.createdAt).getTime()));
    if (!Number.isFinite(oldest) || Date.now() - oldest >= 15 * 60_000) return;
    const delays = [1, 2, 4, 8, 15];
    const delaySeconds = immediate ? 0 : (delays[this.sendPollingAttempt] ?? 15);
    this.sendPollingTimer = setTimeout(() => void this.pollSendStates(), delaySeconds * 1_000);
  }

  private async pollSendStates(): Promise<void> {
    this.sendPollingTimer = null;
    const states = this.sendStatesState().filter((state) => state.state !== 'failed_retryable');
    let terminalObserved = false;
    await Promise.all(states.map(async (state) => {
      try {
        const response = await firstValueFrom(this.api.getSend(state.clientMessageId));
        terminalObserved ||= response.data.state === 'committed' || response.data.state === 'failed';
        this.mergeSendState(response.data);
      } catch {
        // Un fallo transitorio conserva el estado y continúa con backoff.
      }
    }));
    if (terminalObserved) {
      const phone = this.selectedPhoneState();
      if (phone) await this.select(phone, true);
      return;
    }
    this.sendPollingAttempt += 1;
    this.startSendPolling();
  }

  private mergeSendState(state: SendState): void {
    this.sendStatesState.update((states) => {
      if (state.state === 'committed' || state.state === 'failed') {
        return states.filter((candidate) => candidate.clientMessageId !== state.clientMessageId);
      }
      const found = states.some((candidate) => candidate.clientMessageId === state.clientMessageId);
      return found
        ? states.map((candidate) => candidate.clientMessageId === state.clientMessageId ? state : candidate)
        : [...states, state];
    });
  }

  private stopSendPolling(): void {
    if (this.sendPollingTimer !== null) clearTimeout(this.sendPollingTimer);
    this.sendPollingTimer = null;
    this.sendPollingAttempt = 0;
  }

  private async recoverActiveBulkOperations(): Promise<void> {
    const kinds: readonly BulkOperation['kind'][] = ['mark_all_read', 'recalculate_unread'];
    const results = await Promise.allSettled(
      kinds.map((kind) => firstValueFrom(this.api.activeBulk(kind))),
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.data) this.mergeBulkOperation(result.value.data);
    }
    if (this.bulkStatesState().some((operation) => !isBulkTerminal(operation))) {
      this.bulkPollingAttempt = 0;
      this.startBulkPolling();
    }
  }

  private startBulkPolling(immediate = false): void {
    if (this.bulkPollingTimer !== null) clearTimeout(this.bulkPollingTimer);
    this.bulkPollingTimer = null;
    const active = this.bulkStatesState().filter((operation) => !isBulkTerminal(operation));
    if (active.length === 0) return;
    const delays = [1, 2, 4, 8, 15];
    const delay = immediate ? 0 : (delays[this.bulkPollingAttempt] ?? 15);
    this.bulkPollingTimer = setTimeout(() => void this.pollBulkOperations(), delay * 1_000);
  }

  private async pollBulkOperations(): Promise<void> {
    this.bulkPollingTimer = null;
    const active = this.bulkStatesState().filter((operation) => !isBulkTerminal(operation));
    let committed = false;
    await Promise.all(active.map(async (operation) => {
      try {
        const { data } = await firstValueFrom(this.api.bulkOperation(operation.operationId));
        committed ||= data.state === 'committed';
        this.mergeBulkOperation(data);
      } catch {
        // Conserva la operación observada y continúa con backoff ante fallos transitorios.
      }
    }));
    if (committed) await this.load();
    this.bulkPollingAttempt += 1;
    this.startBulkPolling();
  }

  private mergeBulkOperation(operation: BulkOperation): void {
    this.bulkStatesState.update((operations) => {
      const current = operations.find((candidate) => candidate.operationId === operation.operationId);
      if (current && new Date(current.updatedAt).getTime() > new Date(operation.updatedAt).getTime()) {
        return operations;
      }
      const remaining = operations.filter((candidate) => candidate.operationId !== operation.operationId);
      return [...remaining, operation];
    });
  }

  private stopBulkPolling(): void {
    if (this.bulkPollingTimer !== null) clearTimeout(this.bulkPollingTimer);
    this.bulkPollingTimer = null;
    this.bulkPollingAttempt = 0;
  }

  private connectListRealtime(): void {
    if (this.listRealtimeSubscription) return;
    this.listRealtimeSubscription = this.realtime.connect('list').subscribe((notification) => {
      if (notification.kind === 'connection') {
        this.realtimeConnectionState.set(notification.state);
        return;
      }
      if (notification.kind === 'reconcile') {
        void this.load();
        return;
      }
      const { envelope } = notification;
      const sequenceAction = classifyRealtimeSequence(this.listSequence, envelope.sequence);
      if (sequenceAction === 'ignore') return;
      if (sequenceAction === 'reconcile') {
        void this.load();
        return;
      }
      this.listSequence = envelope.sequence;
      void this.load();
    });
  }

  private connectDetailRealtime(phone: string): void {
    if (this.detailRealtimeSubscription && this.realtimePhone === phone) return;
    this.detailRealtimeSubscription?.unsubscribe();
    this.realtimePhone = phone;
    this.detailRealtimeSubscription = this.realtime.connect('detail', phone).subscribe((notification) => {
      if (notification.kind === 'connection') return;
      if (notification.kind === 'reconcile') {
        if (this.selectedPhoneState() === phone) void this.select(phone, true);
        return;
      }
      const { envelope } = notification;
      const sequenceAction = classifyRealtimeSequence(this.detailSequence, envelope.sequence);
      if (sequenceAction === 'ignore') return;
      if (sequenceAction === 'reconcile') {
        if (this.selectedPhoneState() === phone) void this.select(phone, true);
        return;
      }
      this.detailSequence = envelope.sequence;
      if (this.selectedPhoneState() !== phone) return;
      if (envelope.type === 'agent_processing') {
        const { active, expiresAt } = envelope.payload;
        this.detailState.update((detail) => detail?.conversation
          ? {
              ...detail,
              conversation: { ...detail.conversation, agentProcessing: active, agentProcessingUntil: expiresAt },
            }
          : detail);
        this.conversationState.update((items) => items.map((item) => item.phone === phone
          ? { ...item, agentProcessing: active, agentProcessingUntil: expiresAt }
          : item));
        this.scheduleAgentProcessingExpiry(this.detailState()?.conversation ?? null);
        return;
      }
      void this.select(phone, true);
    });
  }

  private mergeConversation(conversation: ConversationSummary): void {
    this.conversationState.update((items) => items.map((item) =>
      item.phone === conversation.phone ? conversation : item,
    ));
    this.detailState.update((detail) => detail?.conversation?.phone === conversation.phone
      ? { ...detail, conversation }
      : detail);
    this.scheduleAgentProcessingExpiry(conversation);
  }

  private scheduleAgentProcessingExpiry(conversation: ConversationSummary | null): void {
    this.stopAgentProcessingTimer();
    if (!conversation?.agentProcessing || !conversation.agentProcessingUntil) return;
    const expectedUntil = conversation.agentProcessingUntil;
    const expiresAt = Date.parse(expectedUntil);
    const remaining = expiresAt - Date.now();
    if (!Number.isFinite(expiresAt) || remaining <= 0) {
      this.clearExpiredAgentProcessing(conversation.phone, expectedUntil);
      return;
    }
    this.agentProcessingTimer = setTimeout(() => {
      this.agentProcessingTimer = null;
      this.clearExpiredAgentProcessing(conversation.phone, expectedUntil);
    }, remaining);
  }

  private clearExpiredAgentProcessing(phone: string, expectedUntil: string): void {
    this.detailState.update((detail) =>
      detail?.conversation?.phone === phone && detail.conversation.agentProcessingUntil === expectedUntil
        ? {
            ...detail,
            conversation: { ...detail.conversation, agentProcessing: false, agentProcessingUntil: null },
          }
        : detail,
    );
    this.conversationState.update((items) => items.map((item) =>
      item.phone === phone && item.agentProcessingUntil === expectedUntil
        ? { ...item, agentProcessing: false, agentProcessingUntil: null }
        : item,
    ));
  }

  private stopAgentProcessingTimer(): void {
    if (this.agentProcessingTimer !== null) clearTimeout(this.agentProcessingTimer);
    this.agentProcessingTimer = null;
  }
}

function isBulkTerminal(operation: BulkOperation): boolean {
  return operation.state === 'committed' || operation.state === 'failed';
}

function messageFromSendState(message: InboxMessage, state: SendState): InboxMessage {
  if (state.state === 'committed') {
    return {
      ...message,
      msgSk: state.result.msgSk,
      createdAt: state.result.createdAt,
      whatsappMessageId: state.result.whatsappMessageId,
      deliveryStatus: 'sent',
    };
  }
  if (state.state === 'failed' || state.state === 'failed_retryable') {
    return { ...message, deliveryStatus: 'failed', deliveryError: state.error };
  }
  return message;
}

function normalizeAgentProcessing(detail: ConversationDetailResponse): ConversationDetailResponse {
  const conversation = detail.conversation;
  if (!conversation?.agentProcessing) return detail;
  const expiresAt = conversation.agentProcessingUntil
    ? Date.parse(conversation.agentProcessingUntil)
    : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return detail;
  return {
    ...detail,
    conversation: { ...conversation, agentProcessing: false, agentProcessingUntil: null },
  };
}

function mergeConversationDetail(
  current: ConversationDetailResponse,
  incoming: ConversationDetailResponse,
): ConversationDetailResponse {
  const byID = new Map(current.messages.map((message) => [message.id, message]));
  for (const message of incoming.messages) byID.set(message.id, message);
  return {
    ...incoming,
    messages: [...byID.values()].sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    ),
    hasMore: current.hasMore,
    nextCursor: current.nextCursor,
  };
}
