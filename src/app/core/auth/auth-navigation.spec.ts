import { describe, expect, it } from 'vitest';
import { safeLoginDestination } from './auth-navigation';

describe('destino después del inicio de sesión', () => {
  it('conserva la conversación derivada', () => {
    expect(safeLoginDestination('/comunicaciones/conversaciones?telefono=56911112222')).toBe(
      '/comunicaciones/conversaciones?telefono=56911112222',
    );
  });
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/login',
    '/\n/evil.example',
    'javascript:alert(1)',
    undefined,
  ])('descarta el destino inseguro %s', (value) => {
    expect(safeLoginDestination(value)).toBe('/inicio');
  });
});
