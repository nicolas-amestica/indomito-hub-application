import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ButtonDirective, type ButtonDirectiveOptions } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { FileUpload, type FileUploadHandlerEvent } from 'primeng/fileupload';
import { Dialog } from 'primeng/dialog';
import { Tooltip } from 'primeng/tooltip';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';

import { ConversationListItemComponent } from '../../components/conversation-list-item/conversation-list-item.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { InboxStore } from '../../stores/inbox.store';
import { InboxAudioRecorderService } from '../../services/inbox-audio-recorder.service';
import { InboxRealtimeService } from '../../services/inbox-realtime.service';
import { getServiceWindowState } from '../../fn/get-service-window-state';
import { focusAfterRender } from '../../fn/focus-after-render';
import { isAllowedInboxAttachment } from '../../fn/is-allowed-inbox-attachment';
import type { InboxMessage } from '../../interfaces/conversation.interface';

@Component({
  selector: 'app-inbox-shell-page',
  imports: [ButtonDirective, ConversationListItemComponent, DatePipe, DecimalPipe, Dialog, FileUpload, FormsModule, HasPermissionDirective, InputText, Message, ScrollingModule, Select, Skeleton, Tag, Textarea, Tooltip],
  providers: [InboxAudioRecorderService, InboxRealtimeService, InboxStore],
  templateUrl: './inbox-shell.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxShellPage implements OnInit {
  readonly store = inject(InboxStore);
  readonly search = signal('');
  readonly reply = signal('');
  readonly replyingTo = signal<InboxMessage | null>(null);
  readonly selectedFiles = signal<readonly File[]>([]);
  readonly attachmentError = signal('');
  readonly recording = signal(false);
  readonly recordingSeconds = signal(0);
  readonly aliasDialogVisible = signal(false);
  readonly deleteDialogVisible = signal(false);
  readonly bulkDialogVisible = signal(false);
  readonly reactivateDialogVisible = signal(false);
  readonly templateDialogVisible = signal(false);
  readonly locationDialogVisible = signal(false);
  readonly contactDialogVisible = signal(false);
  readonly interactiveDialogVisible = signal(false);
  readonly locationLatitude = signal('');
  readonly locationLongitude = signal('');
  readonly locationName = signal('');
  readonly locationAddress = signal('');
  readonly contactName = signal('');
  readonly contactPhone = signal('');
  readonly contactEmail = signal('');
  readonly contactCompany = signal('');
  readonly interactiveKind = signal<'button' | 'list'>('button');
  readonly interactiveBody = signal('');
  readonly interactiveFooter = signal('');
  readonly interactiveButton = signal('Ver opciones');
  readonly interactiveOptionTitles = signal<readonly string[]>(['', '']);
  readonly interactiveKindOptions: { label: string; value: 'button' | 'list' }[] = [{ label: 'Botones de respuesta', value: 'button' }, { label: 'Lista de opciones', value: 'list' }];
  readonly selectedTemplateName = signal('');
  readonly templateParameters = signal<readonly string[]>([]);
  readonly reactionTargetId = signal<string | null>(null);
  readonly reactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
  readonly fileChooseButtonProps: ButtonDirectiveOptions = {
    iconOnly: true,
    outlined: true,
    rounded: true,
    severity: 'secondary',
  };
  readonly selectedTemplate = computed(() => this.store.templates().find((template) => `${template.name}:${template.language}` === this.selectedTemplateName()) ?? null);
  readonly templateOptions = computed(() => this.store.templates().map((template) => ({ label: `${template.name} · ${template.language}`, value: `${template.name}:${template.language}` })));
  readonly alias = signal('');
  readonly draggingFiles = signal(false);
  readonly messagePinnedToBottom = signal(true);
  readonly now = signal(Date.now());
  readonly serviceWindowState = computed(() => getServiceWindowState(
    this.store.detail()?.conversation?.serviceWindowExpiresAt ?? null,
    this.now(),
  ));
  readonly messageViewport = viewChild<ElementRef<HTMLDivElement>>('messageViewport');
  readonly inboxContent = viewChild<ElementRef<HTMLElement>>('inboxContent');
  readonly conversationSearch = viewChild<ElementRef<HTMLInputElement>>('conversationSearch');
  private readonly audioRecorder = inject(InboxAudioRecorderService);
  private readonly destroyRef = inject(DestroyRef);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly clockTimer = setInterval(() => this.now.set(Date.now()), 30_000);

  constructor() {
    effect(() => {
      this.store.messages().length;
      this.store.sendStates().length;
      if (this.messagePinnedToBottom()) this.scrollToBottom();
    });
    this.destroyRef.onDestroy(() => {
      this.cancelSearchTimer();
      this.cancelRecording();
      clearInterval(this.clockTimer);
    });
  }

  ngOnInit(): void {
    void this.store.load();
  }

  readonly trackConversation = (_index: number, conversation: { readonly phone: string }): string => conversation.phone;

  searchChanged(value: string): void {
    this.search.set(value);
    this.store.setQuery(value);
    this.cancelSearchTimer();
    this.searchTimer = setTimeout(() => void this.store.load(), 300);
  }

  submitSearch(): void {
    this.cancelSearchTimer();
    void this.store.load();
  }

  async sendReply(): Promise<void> {
    if (this.serviceWindowState() === 'closed') return;
    const content = this.reply();
    const files = this.selectedFiles();
    if (!content.trim() && files.length === 0) return;
    this.reply.set('');
    const sent = files.length > 0
      ? await this.store.sendAttachments(files, content)
      : await this.store.sendReply(content, this.replyingTo());
    if (sent) this.selectedFiles.set([]);
    if (sent) this.replyingTo.set(null);
    if (!sent) this.reply.set(content);
  }

  async openTemplateDialog(): Promise<void> {
    if (!await this.store.loadTemplates()) return;
    const first = this.store.templates()[0];
    this.selectedTemplateName.set(first ? `${first.name}:${first.language}` : '');
    this.syncTemplateParameters();
    this.templateDialogVisible.set(true);
  }

  selectTemplate(value: string): void {
    this.selectedTemplateName.set(value);
    this.syncTemplateParameters();
  }

  updateTemplateParameter(index: number, value: string): void {
    this.templateParameters.update((items) => items.map((item, current) => current === index ? value : item));
  }

  async confirmSendTemplate(): Promise<void> {
    const template = this.selectedTemplate();
    if (!template || this.templateParameters().some((value) => !value.trim())) return;
    if (await this.store.sendTemplate(template, this.templateParameters())) this.templateDialogVisible.set(false);
  }

  async confirmSendLocation(): Promise<void> {
    const latitude = Number(this.locationLatitude());
    const longitude = Number(this.locationLongitude());
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;
    const sent = await this.store.sendRichMessage({ kind: 'location', location: { latitude, longitude, name: this.locationName().trim(), address: this.locationAddress().trim() } });
    if (sent) this.locationDialogVisible.set(false);
  }

  async confirmSendContact(): Promise<void> {
    const name = this.contactName().trim();
    const phone = this.contactPhone().trim();
    if (!name || !/^\+?[0-9]{8,15}$/.test(phone)) return;
    const sent = await this.store.sendRichMessage({ kind: 'contacts', contacts: [{ name, phone, email: this.contactEmail().trim(), company: this.contactCompany().trim() }] });
    if (sent) this.contactDialogVisible.set(false);
  }

  openLocationDialog(): void {
    this.locationLatitude.set(''); this.locationLongitude.set(''); this.locationName.set(''); this.locationAddress.set('');
    this.locationDialogVisible.set(true);
  }

  openContactDialog(): void {
    this.contactName.set(''); this.contactPhone.set(''); this.contactEmail.set(''); this.contactCompany.set('');
    this.contactDialogVisible.set(true);
  }

  openInteractiveDialog(): void {
    this.interactiveKind.set('button'); this.interactiveBody.set(''); this.interactiveFooter.set(''); this.interactiveButton.set('Ver opciones'); this.interactiveOptionTitles.set(['', '']);
    this.interactiveDialogVisible.set(true);
  }

  updateInteractiveOption(index: number, value: string): void {
    this.interactiveOptionTitles.update((items) => items.map((item, current) => current === index ? value : item));
  }

  addInteractiveOption(): void {
    const maximum = this.interactiveKind() === 'button' ? 3 : 10;
    if (this.interactiveOptionTitles().length < maximum) this.interactiveOptionTitles.update((items) => [...items, '']);
  }

  removeInteractiveOption(index: number): void {
    if (this.interactiveOptionTitles().length > 1) this.interactiveOptionTitles.update((items) => items.filter((_, current) => current !== index));
  }

  async confirmSendInteractive(): Promise<void> {
    const body = this.interactiveBody().trim();
    const titles = this.interactiveOptionTitles().map((title) => title.trim()).filter(Boolean);
    if (!body || titles.length !== this.interactiveOptionTitles().length) return;
    const kind = this.interactiveKind();
    const sent = await this.store.sendRichMessage({ kind: 'interactive', interactive: { kind, body, footer: this.interactiveFooter().trim(), button: kind === 'list' ? this.interactiveButton().trim() : '', options: titles.map((title, index) => ({ id: `option-${index + 1}`, title, description: '' })) } });
    if (sent) this.interactiveDialogVisible.set(false);
  }

  private syncTemplateParameters(): void {
    this.templateParameters.set(Array.from({ length: this.selectedTemplate()?.parameterCount ?? 0 }, () => ''));
  }

  selectReplyTarget(message: InboxMessage): void {
    if (!message.whatsappMessageId || this.serviceWindowState() === 'closed') return;
    this.selectedFiles.set([]);
    this.attachmentError.set('');
    this.replyingTo.set(message);
  }

  async setReaction(message: InboxMessage, emoji: string): Promise<void> {
    const current = message.reactions?.find((reaction) => reaction.actor === 'team')?.emoji;
    if (await this.store.setReaction(message, current === emoji ? '' : emoji)) this.reactionTargetId.set(null);
  }

  async selectConversation(phone: string): Promise<void> {
    this.messagePinnedToBottom.set(true);
    await this.store.select(phone);
    this.scrollToBottom();
    focusAfterRender(() => this.inboxContent()?.nativeElement);
  }

  returnToConversationList(): void {
    this.store.clearSelection();
    focusAfterRender(() => this.conversationSearch()?.nativeElement);
  }

  async loadOlderMessages(): Promise<void> {
    const viewport = this.messageViewport()?.nativeElement;
    const previousHeight = viewport?.scrollHeight ?? 0;
    this.messagePinnedToBottom.set(false);
    if (!await this.store.loadOlderMessages() || !viewport) {
      this.handleMessageScroll();
      return;
    }
    requestAnimationFrame(() => {
      viewport.scrollTop += viewport.scrollHeight - previousHeight;
    });
  }

  handleMessageScroll(): void {
    const viewport = this.messageViewport()?.nativeElement;
    if (!viewport) return;
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    this.messagePinnedToBottom.set(distance <= 64);
  }

  jumpToLatestMessage(): void {
    this.messagePinnedToBottom.set(true);
    this.scrollToBottom();
  }

  handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void this.sendReply();
  }

  handlePaste(event: ClipboardEvent): void {
    if (this.serviceWindowState() === 'closed') return;
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length === 0) return;
    event.preventDefault();
    this.addFiles(files);
  }

  handleDragOver(event: DragEvent): void {
    if (this.serviceWindowState() === 'closed') return;
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.draggingFiles.set(true);
  }

  handleDragLeave(event: DragEvent): void {
    if (event.currentTarget === event.target) this.draggingFiles.set(false);
  }

  handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.draggingFiles.set(false);
    if (this.serviceWindowState() === 'closed') return;
    this.addFiles([...(event.dataTransfer?.files ?? [])]);
  }

  selectFiles(event: FileUploadHandlerEvent, uploader: FileUpload): void {
    this.addFiles(event.files);
    uploader.clear();
  }

  async selectSticker(event: FileUploadHandlerEvent, uploader: FileUpload): Promise<void> {
    const file = event.files[0];
    uploader.clear();
    if (!file || file.type !== 'image/webp' || file.size < 1 || file.size > 500 * 1024) {
      this.attachmentError.set('El sticker debe ser WebP y pesar como máximo 500 KiB.');
      return;
    }
    this.attachmentError.set('');
    await this.store.sendSticker(file);
  }

  private addFiles(incoming: readonly File[]): void {
    const combined = [...this.selectedFiles(), ...incoming];
    const allowed = combined.filter((file) => isAllowedInboxAttachment(file)).slice(0, 20);
    this.selectedFiles.set(allowed);
    this.attachmentError.set(
      allowed.length !== combined.length
        ? 'Puedes adjuntar hasta 20 PDF, JPEG, PNG de 8 bits, audios compatibles o videos MP4 de máximo 7 MiB. Usa WebP solo como sticker; GIF no es compatible.'
        : '',
    );
  }

  removeFile(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, current) => current !== index));
    this.attachmentError.set('');
  }

  async toggleRecording(): Promise<void> {
    if (this.serviceWindowState() === 'closed') return;
    if (this.recording()) {
      await this.finishRecording();
      return;
    }
    this.attachmentError.set('');
    try {
      await this.audioRecorder.start();
      this.recording.set(true);
      this.recordingSeconds.set(0);
      this.recordingTimer = setInterval(() => this.recordingSeconds.update((value) => value + 1), 1_000);
    } catch {
      this.attachmentError.set('No fue posible acceder al micrófono o el navegador no admite grabación compatible.');
    }
  }

  private async finishRecording(): Promise<void> {
    this.stopRecordingTimer();
    this.recording.set(false);
    try {
      const file = await this.audioRecorder.stop();
      if (!isAllowedInboxAttachment(file)) {
        this.attachmentError.set('El audio está vacío o supera el máximo de 7 MiB.');
        return;
      }
      this.selectedFiles.update((files) => [...files.slice(0, 19), file]);
    } catch {
      this.attachmentError.set('No fue posible finalizar la grabación de audio.');
    }
  }

  private cancelRecording(): void {
    this.stopRecordingTimer();
    this.recording.set(false);
    this.audioRecorder.cancel();
  }

  private stopRecordingTimer(): void {
    if (this.recordingTimer === null) return;
    clearInterval(this.recordingTimer);
    this.recordingTimer = null;
  }

  openAliasDialog(): void {
    this.alias.set(this.store.detail()?.conversation?.alias ?? '');
    this.aliasDialogVisible.set(true);
  }

  async saveAlias(): Promise<void> {
    if (await this.store.updateContact(this.alias())) this.aliasDialogVisible.set(false);
  }

  async confirmDelete(): Promise<void> {
    if (await this.store.deleteConversation()) this.deleteDialogVisible.set(false);
  }

  async confirmMarkAllRead(): Promise<void> {
    this.bulkDialogVisible.set(false);
    await this.store.markAllRead();
  }

  async confirmReactivateAgent(): Promise<void> {
    if (await this.store.reactivateAgent()) this.reactivateDialogVisible.set(false);
  }

  private cancelSearchTimer(): void {
    if (this.searchTimer === null) return;
    clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const viewport = this.messageViewport()?.nativeElement;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
        this.messagePinnedToBottom.set(true);
      }
    });
  }

}
