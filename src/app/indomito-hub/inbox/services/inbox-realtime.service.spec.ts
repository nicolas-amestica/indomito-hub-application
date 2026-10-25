import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { InboxApiService } from './inbox-api.service';
import { InboxRealtimeService, parseRealtimeEnvelope } from './inbox-realtime.service';

class FakeWebSocket {
  static readonly instances: FakeWebSocket[] = [];
  private readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close(): void {
    this.emit('close');
  }

  emit(type: string, data?: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as MessageEvent);
    }
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeWebSocket.instances.length = 0;
});

describe('parseRealtimeEnvelope', () => {
  it('acepta un envelope secuenciado válido', () => {
    const envelope = parseRealtimeEnvelope(JSON.stringify({
      eventId: '01K7J8QZD00000000000000000',
      type: 'conversation.updated',
      stream: 'list',
      sequence: 4,
      occurredAt: '2026-10-14T13:00:00Z',
      payload: {},
    }));
    expect(envelope?.sequence).toBe(4);
  });

  it('rechaza JSON inválido y secuencias no enteras', () => {
    expect(parseRealtimeEnvelope('{')).toBeNull();
    expect(parseRealtimeEnvelope(JSON.stringify({
      eventId: 'invalid', type: 'x', stream: 'list', sequence: 1.5,
      occurredAt: '2026-10-14T13:00:00Z', payload: {},
    }))).toBeNull();
  });

  it('acepta el estado de procesamiento cuando coincide con el stream del teléfono', () => {
    const envelope = parseRealtimeEnvelope(JSON.stringify({
      eventId: '01K7J8QZD00000000000000001',
      type: 'agent_processing',
      stream: 'detail:56912345678',
      sequence: 5,
      occurredAt: '2026-10-14T13:00:00Z',
      payload: {
        phone: '56912345678',
        active: true,
        expiresAt: '2026-10-14T13:04:00Z',
      },
    }));

    expect(envelope?.type).toBe('agent_processing');
    if (envelope?.type === 'agent_processing') {
      expect(envelope.payload.active).toBe(true);
    }
  });

  it('rechaza estados de procesamiento mal formados o de otro stream', () => {
    const base = {
      eventId: '01K7J8QZD00000000000000002',
      type: 'agent_processing',
      stream: 'detail:56912345678',
      sequence: 6,
      occurredAt: '2026-10-14T13:00:00Z',
    };

    expect(parseRealtimeEnvelope(JSON.stringify({
      ...base,
      payload: { phone: '56999999999', active: true, expiresAt: null },
    }))).toBeNull();
    expect(parseRealtimeEnvelope(JSON.stringify({
      ...base,
      payload: { phone: '56912345678', active: 'yes', expiresAt: null },
    }))).toBeNull();
  });
});

describe('InboxRealtimeService', () => {
  it('reconecta con backoff y solicita reconciliación antes y después de recuperar conexión', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const api = {
      subscription: vi.fn().mockReturnValue(of({
        data: { url: 'wss://inbox.example.test', ticket: 'ticket-1', expiresAt: '2026-10-24T01:00:00Z' },
      })),
    };
    TestBed.configureTestingModule({
      providers: [InboxRealtimeService, { provide: InboxApiService, useValue: api }],
    });
    const notifications: string[] = [];
    const subscription = TestBed.inject(InboxRealtimeService).connect('list').subscribe((notification) => {
      notifications.push(notification.kind === 'connection' ? notification.state : notification.kind);
    });

    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    FakeWebSocket.instances[0]?.emit('open');
    FakeWebSocket.instances[0]?.emit('close');
    expect(notifications).toEqual(['connected', 'reconnecting', 'reconcile']);

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    FakeWebSocket.instances[1]?.emit('open');

    expect(api.subscription).toHaveBeenCalledTimes(2);
    expect(notifications).toEqual(['connected', 'reconnecting', 'reconcile', 'connected', 'reconcile']);
    subscription.unsubscribe();
  });
});
