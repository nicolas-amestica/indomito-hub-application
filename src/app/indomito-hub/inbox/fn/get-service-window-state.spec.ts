import { getServiceWindowState } from './get-service-window-state';

describe('getServiceWindowState', () => {
  it.each([
    { expiresAt: null, expected: 'unknown' },
    { expiresAt: 'valor-invalido', expected: 'unknown' },
    { expiresAt: '2026-10-23T12:00:01.000Z', expected: 'open' },
    { expiresAt: '2026-10-23T12:00:00.000Z', expected: 'closed' },
    { expiresAt: '2026-10-23T11:59:59.000Z', expected: 'closed' },
  ] as const)('retorna $expected para $expiresAt', ({ expiresAt, expected }) => {
    expect(getServiceWindowState(expiresAt, Date.parse('2026-10-23T12:00:00.000Z'))).toBe(expected);
  });
});
