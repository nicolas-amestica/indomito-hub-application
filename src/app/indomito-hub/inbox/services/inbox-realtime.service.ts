import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import type { RealtimeEnvelope } from '../types/inbox.types';
import { InboxApiService } from './inbox-api.service';

const EVENT_TYPES = new Set([
  'conversation.updated', 'conversation.deleted', 'message.created',
  'message.delivery.updated', 'message.reactions.updated', 'agent_processing', 'bulk.updated', 'resync_required',
]);
const EVENT_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const STREAM_PATTERN = /^(list|detail:[0-9]{8,15})$/;

export type RealtimeNotification =
  | { readonly kind: 'event'; readonly envelope: RealtimeEnvelope }
  | { readonly kind: 'reconcile' };

@Injectable()
export class InboxRealtimeService {
  private readonly api = inject(InboxApiService);

  connect(scope: 'list' | 'detail', phone?: string): Observable<RealtimeNotification> {
    return new Observable((subscriber) => {
      let socket: WebSocket | null = null;
      let closed = false;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let attempt = 0;
      let opened = false;

      const open = async (): Promise<void> => {
        try {
          const { data } = await firstValueFrom(this.api.subscription(scope, phone));
          if (closed) return;
          const url = new URL(data.url);
          url.searchParams.set('ticket', data.ticket);
          socket = new WebSocket(url);
          socket.addEventListener('open', () => {
            attempt = 0;
            if (opened) subscriber.next({ kind: 'reconcile' });
            opened = true;
          });
          socket.addEventListener('message', (message) => {
            const envelope = parseRealtimeEnvelope(message.data);
            if (envelope) subscriber.next({ kind: 'event', envelope });
            else subscriber.next({ kind: 'reconcile' });
          });
          socket.addEventListener('close', () => scheduleReconnect());
          socket.addEventListener('error', () => socket?.close());
        } catch {
          scheduleReconnect();
        }
      };

      const scheduleReconnect = (): void => {
        if (closed || reconnectTimer !== null) return;
        subscriber.next({ kind: 'reconcile' });
        const delays = [1, 2, 4, 8, 15];
        const delay = delays[attempt] ?? 15;
        attempt += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void open();
        }, delay * 1_000);
      };

      void open();
      return () => {
        closed = true;
        if (reconnectTimer !== null) clearTimeout(reconnectTimer);
        socket?.close(1000, 'route closed');
      };
    });
  }
}

export function parseRealtimeEnvelope(value: unknown): RealtimeEnvelope | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed['eventId'] !== 'string' || !EVENT_ID_PATTERN.test(parsed['eventId']) ||
      typeof parsed['type'] !== 'string' || !EVENT_TYPES.has(parsed['type']) ||
      typeof parsed['stream'] !== 'string' || !STREAM_PATTERN.test(parsed['stream']) ||
      !Number.isSafeInteger(parsed['sequence']) || Number(parsed['sequence']) < 1 ||
      typeof parsed['occurredAt'] !== 'string' || Number.isNaN(Date.parse(parsed['occurredAt'])) ||
      parsed['payload'] === null ||
      typeof parsed['payload'] !== 'object' || Array.isArray(parsed['payload'])
    ) return null;
    if (parsed['type'] === 'agent_processing' && !isAgentProcessingEnvelope(parsed)) return null;
    return parsed as unknown as RealtimeEnvelope;
  } catch {
    return null;
  }
}

function isAgentProcessingEnvelope(parsed: Record<string, unknown>): boolean {
  if (typeof parsed['stream'] !== 'string' || !parsed['stream'].startsWith('detail:')) return false;
  const payload = parsed['payload'] as Record<string, unknown>;
  const expiresAt = payload['expiresAt'];
  return typeof payload['phone'] === 'string' &&
    /^[0-9]{8,15}$/.test(payload['phone']) &&
    parsed['stream'] === `detail:${payload['phone']}` &&
    typeof payload['active'] === 'boolean' &&
    (expiresAt === null || (typeof expiresAt === 'string' && !Number.isNaN(Date.parse(expiresAt))));
}
