import { formatInboxTime } from './format-inbox-time';

describe('formatInboxTime', () => {
  it('muestra hora para una conversación del mismo día', () => {
    expect(formatInboxTime('2026-10-14T13:05:00.000Z', new Date('2026-10-14T16:00:00.000Z'))).toMatch(/10:05|13:05/u);
  });

  it('muestra día y mes para conversaciones anteriores', () => {
    expect(formatInboxTime('2026-10-12T13:05:00.000Z', new Date('2026-10-14T16:00:00.000Z'))).toContain('12');
  });

  it('tolera fechas ausentes o inválidas', () => {
    expect(formatInboxTime(null)).toBe('');
    expect(formatInboxTime('fecha-invalida')).toBe('');
  });
});
