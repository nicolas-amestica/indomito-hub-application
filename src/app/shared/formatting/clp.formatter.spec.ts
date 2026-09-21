/**
 * Tests unitarios del formateo de montos en CLP.
 *
 * Cubren los ejemplos concretos y las fronteras del Requirement 9.7. La
 * reversibilidad general sobre todo el rango de enteros es la Propiedad 30 y se
 * verifica aparte con `fast-check`; acá se fijan los casos que un generador
 * aleatorio visitaría con baja probabilidad: el cero, el cero negativo, el
 * primer valor que agrupa y los extremos del rango seguro.
 */

import { describe, expect, it } from 'vitest';
import { CLP_LOCALE, formatCLP, parseCLP } from './clp.formatter';

describe('formatCLP', () => {
  it('usa el punto como separador de miles, que es lo que define es-CL', () => {
    // Comprobación de entorno además de comportamiento: si el ICU que corre los
    // tests no conociera es-CL, caería a un locale de respaldo y acá se vería.
    expect(CLP_LOCALE).toBe('es-CL');
    expect(formatCLP(1234)).toBe('1.234');
    expect(formatCLP(1234567)).toBe('1.234.567');
  });

  it('no agrupa los montos de tres dígitos o menos', () => {
    expect(formatCLP(0)).toBe('0');
    expect(formatCLP(7)).toBe('7');
    expect(formatCLP(999)).toBe('999');
    expect(formatCLP(1000)).toBe('1.000');
  });

  it('nunca emite separador decimal', () => {
    for (const amount of [0, 5, 999, 1000, 123456, 987654321]) {
      expect(formatCLP(amount)).not.toContain(',');
    }
  });

  it('conserva el signo de los montos negativos', () => {
    expect(formatCLP(-1)).toBe('-1');
    expect(formatCLP(-1234567)).toBe('-1.234.567');
  });

  it('normaliza el cero negativo a cero sin signo', () => {
    expect(formatCLP(-0)).toBe('0');
  });

  it('formatea los extremos del rango de enteros seguros', () => {
    expect(parseCLP(formatCLP(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseCLP(formatCLP(Number.MIN_SAFE_INTEGER))).toBe(Number.MIN_SAFE_INTEGER);
  });

  it('rechaza todo lo que no sea un entero seguro', () => {
    for (const invalid of [
      1.5,
      -0.1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 2,
    ]) {
      expect(() => formatCLP(invalid)).toThrow(RangeError);
    }
  });
});

describe('parseCLP', () => {
  it('recupera el entero exacto de una cadena formateada', () => {
    for (const amount of [0, 1, 999, 1000, 1234567, -8, -1000, -1234567]) {
      expect(parseCLP(formatCLP(amount))).toBe(amount);
    }
  });

  it('lee cadenas sin separadores de miles', () => {
    expect(parseCLP('1234567')).toBe(1234567);
    expect(parseCLP('-42')).toBe(-42);
  });

  it('ignora los espacios en los extremos', () => {
    expect(parseCLP('  1.000  ')).toBe(1000);
  });

  it('devuelve cero sin signo para el cero negativo', () => {
    expect(parseCLP('-0')).toBe(0);
    expect(Object.is(parseCLP('-0'), 0)).toBe(true);
  });

  it('rechaza las cadenas que no representan un monto entero', () => {
    for (const invalid of ['', '   ', '1.234,5', '0,5', 'mil', '1.234 CLP', '$1.000', '-', '1e6']) {
      expect(parseCLP(invalid)).toBeNull();
    }
  });

  it('rechaza los montos fuera del rango de enteros seguros', () => {
    expect(parseCLP('9.007.199.254.740.993')).toBeNull();
  });
});
