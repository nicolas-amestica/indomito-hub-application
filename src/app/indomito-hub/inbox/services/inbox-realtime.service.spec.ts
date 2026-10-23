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
