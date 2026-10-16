import { parseRealtimeEnvelope } from './inbox-realtime.service';

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
});
