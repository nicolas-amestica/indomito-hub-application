import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import type { ConversationDetailResponse, ConversationSummary } from '../../interfaces/conversation.interface';
import { InboxAudioRecorderService } from '../../services/inbox-audio-recorder.service';
import { InboxRealtimeService } from '../../services/inbox-realtime.service';
import { InboxStore } from '../../stores/inbox.store';
import { InboxShellPage } from './inbox-shell.page';

const conversation: ConversationSummary = {
  id: 'conversation-responsive',
  phone: '56911111111',
  alias: 'Cliente de prueba',
  channel: 'whatsapp',
  status: 'bot',
  reason: null,
  reasonLabel: null,
  agentProcessing: false,
  agentProcessingUntil: null,
  unreadCount: 2,
  lastMessagePreview: 'Mensaje de prueba para validar el layout responsive',
  lastMessageAt: '2026-10-24T12:00:00Z',
  serviceWindowExpiresAt: '2026-10-24T23:00:00Z',
  createdAt: '2026-10-24T12:00:00Z',
  updatedAt: '2026-10-24T12:00:00Z',
  generation: 1,
};

const detailResponse: ConversationDetailResponse = {
  mode: 'full',
  conversation,
  messages: [{
    id: 'message-responsive',
    msgSk: 'MSG#responsive',
    phone: conversation.phone,
    type: 'customer',
    content: 'Necesito ayuda para organizar mi viaje.',
    createdAt: '2026-10-24T12:00:00Z',
    whatsappMessageId: 'wamid.responsive',
    deliveryStatus: null,
    deliveryError: null,
    attachments: [],
    replyTo: null,
  }],
  hasMore: false,
  nextCursor: null,
  nonTerminalSends: [],
  watermark: { stream: 'detail:56911111111', sequence: 1 },
};

const createStoreMock = (): InboxStore => {
  const selectedPhone = signal<string | null>(null);
  const detail = signal<ConversationDetailResponse | null>(null);
  const filter = signal<'all' | 'unread'>('all');
  const conversations = signal<readonly ConversationSummary[]>([conversation]);
  const emptyList = signal<readonly never[]>([]);
  const falseState = signal(false);
  const nullState = signal<null>(null);

  return {
    selectedPhone,
    detail,
    filter,
    conversations,
    visibleConversations: computed(() => conversations()),
    loading: falseState,
    loadingMore: falseState,
    loadingOlder: falseState,
    error: nullState,
    unreadTotal: signal(2),
    sending: falseState,
    sendStates: emptyList,
    mutating: falseState,
    templates: emptyList,
    realtimeConnection: signal<'connected' | 'reconnecting'>('connected'),
    agentProcessing: falseState,
    bulkOperation: nullState,
    messages: computed(() => detail()?.messages ?? []),
    messageDateLabels: computed(() => new Map<string, string>()),
    messageGroupContinuations: computed(() => new Set<string>()),
    messageLinkPreviews: computed(() => new Map()),
    hasMore: falseState,
    hasOlderMessages: falseState,
    load: async () => undefined,
    loadMore: async () => undefined,
    loadOlderMessages: async () => false,
    loadTemplates: async () => true,
    select: async (phone: string) => { selectedPhone.set(phone); detail.set(detailResponse); },
    clearSelection: () => { selectedPhone.set(null); detail.set(null); },
    setFilter: filter.set,
    setQuery: () => undefined,
    sendReply: async () => true,
    sendAttachments: async () => true,
    sendSticker: async () => true,
    sendTemplate: async () => true,
    sendRichMessage: async () => true,
    setReaction: async () => true,
    retrySend: async () => undefined,
    updateContact: async () => true,
    deleteConversation: async () => true,
    markUnread: async () => undefined,
    markAllRead: async () => undefined,
    reactivateAgent: async () => true,
  } as unknown as InboxStore;
};

const isRealBrowser = !navigator.userAgent.toLowerCase().includes('jsdom');

describe('InboxShellPage responsive layout', () => {
  it.runIf(isRealBrowser)('mantiene navegación y contenido sin overflow en los cuatro anchos P3', async () => {
    const axe = (await import('axe-core')).default;
    const { page } = await import('vitest/browser');
    const store = createStoreMock();
    TestBed.configureTestingModule({
      imports: [InboxShellPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { canPerform: () => true } }],
    });
    TestBed.overrideComponent(InboxShellPage, {
      set: {
        providers: [
          { provide: InboxStore, useValue: store },
          { provide: InboxAudioRecorderService, useValue: { cancel: () => undefined } },
          { provide: InboxRealtimeService, useValue: {} },
        ],
      },
    });

    const fixture = TestBed.createComponent(InboxShellPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const aside = root.querySelector('aside') as HTMLElement;
    const main = root.querySelector('main') as HTMLElement;
    const expectNoAccessibilityViolations = async (state: string): Promise<void> => {
      const result = await axe.run(root, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
      });
      expect(
        result.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map(({ target }) => target),
        })),
        `${state} no debe tener infracciones Axe`,
      ).toEqual([]);
    };

    for (const width of [320, 390, 768, 1440]) {
      await page.viewport(width, 900);
      fixture.detectChanges();
      expect(root.scrollWidth, `${width}px no debe desbordar horizontalmente`).toBeLessThanOrEqual(width);
      expect(getComputedStyle(aside).display, `${width}px debe mostrar la lista inicial`).not.toBe('none');
      const viewport = root.querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
      const conversationButton = root.querySelector<HTMLButtonElement>('app-conversation-list-item button')!;
      const unreadBadge = root.querySelector<HTMLElement>('[aria-label="2 mensajes no leídos"]')!;
      expect(aside.getBoundingClientRect().width, `${width}px debe usar todo el ancho móvil disponible`).toBeGreaterThanOrEqual(width < 768 ? width - 2 : 380);
      expect(viewport.scrollWidth, `${width}px la lista no debe tener scroll horizontal`).toBeLessThanOrEqual(viewport.clientWidth);
      expect(conversationButton.getBoundingClientRect().right, `${width}px debe mostrar la fila completa`).toBeLessThanOrEqual(viewport.getBoundingClientRect().right);
      expect(unreadBadge.getBoundingClientRect().right, `${width}px debe mostrar el contador de no leídos`).toBeLessThanOrEqual(viewport.getBoundingClientRect().right);
      await expectNoAccessibilityViolations(`${width}px lista`);
      await page.screenshot({
        path: `../../../../../../artifacts/p3-responsive/inbox-${width}-list.png`,
      });

      await fixture.componentInstance.selectConversation(conversation.phone);
      fixture.detectChanges();
      await fixture.whenStable();
      const uploadButtonNames = [...root.querySelectorAll('p-fileupload button')]
        .map((button) => button.textContent?.trim());
      expect(uploadButtonNames).toEqual([
        'Seleccionar sticker WebP',
        'Seleccionar archivos adjuntos',
      ]);
      expect(getComputedStyle(main).display, `${width}px debe mostrar la conversación`).not.toBe('none');
      expect(root.scrollWidth, `${width}px no debe desbordar con conversación abierta`).toBeLessThanOrEqual(width);
      await expectNoAccessibilityViolations(`${width}px conversación`);
      await page.screenshot({
        path: `../../../../../../artifacts/p3-responsive/inbox-${width}-conversation.png`,
      });

      fixture.componentInstance.returnToConversationList();
      fixture.detectChanges();
    }
  });

  it.runIf(isRealBrowser)('permite recorrer y activar el flujo móvil principal solo con teclado', async () => {
    const { page, userEvent } = await import('vitest/browser');
    const store = createStoreMock();
    TestBed.configureTestingModule({
      imports: [InboxShellPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { canPerform: () => true } }],
    });
    TestBed.overrideComponent(InboxShellPage, {
      set: {
        providers: [
          { provide: InboxStore, useValue: store },
          { provide: InboxAudioRecorderService, useValue: { cancel: () => undefined } },
          { provide: InboxRealtimeService, useValue: {} },
        ],
      },
    });

    await page.viewport(320, 900);
    const fixture = TestBed.createComponent(InboxShellPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const search = root.querySelector<HTMLInputElement>('[name="conversation-search"]')!;
    const filter = root.querySelector<HTMLButtonElement>('[aria-label="Mostrar solo no leídas"]')!;

    search.focus();
    expect(document.activeElement).toBe(search);
    await userEvent.tab();
    expect(document.activeElement).toBe(filter);
    await userEvent.keyboard('{Space}');
    fixture.detectChanges();
    expect(filter.getAttribute('aria-pressed')).toBe('true');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const conversationButton = root.querySelector<HTMLButtonElement>('app-conversation-list-item button')!;
    await userEvent.tab();
    expect(document.activeElement).toBe(conversationButton);
    await userEvent.keyboard('{Enter}');
    await fixture.whenStable();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    fixture.detectChanges();

    const main = root.querySelector<HTMLElement>('main')!;
    expect(document.activeElement).toBe(main);
    await userEvent.tab();
    const backButton = root.querySelector<HTMLButtonElement>('[aria-label="Volver a conversaciones"]')!;
    expect(document.activeElement).toBe(backButton);
    await userEvent.keyboard('{Enter}');
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    fixture.detectChanges();
    expect(document.activeElement).toBe(search);
  });
});
