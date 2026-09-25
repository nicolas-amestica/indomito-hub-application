/**
 * Tests de ejemplo del validador de documento de identidad (Requirement 5.9).
 *
 * Cubren tres cosas que un test de propiedad no cubre bien: los documentos de
 * referencia públicos —`12.345.678-5` y `111.444.777-35`—, los casos que solo
 * existen por la forma del `ValidatorFn` (control vacío, valor no textual) y las
 * consecuencias de que el DNI argentino no tenga dígito verificador.
 *
 * La Propiedad 18 (tarea 8.2) es la que cubre el espacio completo contrastando
 * este validador con los generadores de `__arbitraries__`.
 */

import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ID_ERROR_KEY,
  documentIdValidator,
  isValidDocumentId,
} from './document-id.validator';

/** Aplica el validador sobre un control con el valor indicado. */
function validate(value: unknown) {
  return documentIdValidator(new FormControl(value));
}

describe('isValidDocumentId', () => {
  describe('RUT chileno', () => {
    it.each([
      '12.345.678-5',
      '12345678-5',
      '123456785',
      '12 345 678 5',
      '10000013-K',
      '10000013-k',
      '1234567-4',
    ])('acepta %s', (value) => {
      expect(isValidDocumentId(value)).toBe(true);
    });

    it('acepta únicamente el RUT de excepción 1-9', () => {
      expect(isValidDocumentId('1-9')).toBe(true);
      expect(isValidDocumentId(' 1-9 ')).toBe(true);
      expect(isValidDocumentId('1-8')).toBe(false);
      expect(isValidDocumentId('2-7')).toBe(false);
    });

    it('rechaza un cuerpo de ocho dígitos con el verificador equivocado', () => {
      // Nueve caracteres normalizados: ni el DNI ni el CPF pueden rescatarlo, así
      // que el rechazo depende solo del dígito verificador.
      expect(isValidDocumentId('12.345.678-4')).toBe(false);
      expect(isValidDocumentId('10000013-9')).toBe(false);
    });

    it('rechaza la K en una posición que no es la del verificador', () => {
      expect(isValidDocumentId('1234K678-5')).toBe(false);
    });
  });

  describe('DNI argentino', () => {
    it.each(['1234567', '1.234.567', '12345670', '99999999'])('acepta %s', (value) => {
      expect(isValidDocumentId(value)).toBe(true);
    });

    it('acepta un RUT de cuerpo de siete dígitos con verificador equivocado, por ser un DNI plausible', () => {
      // `12345678` no es un RUT válido —al cuerpo `1234567` le corresponde el
      // verificador 4— pero sí es un DNI de ocho dígitos. Que el DNI no tenga
      // verificador es inherente al formato, no una laxitud del validador.
      expect(isValidDocumentId('1234567-8')).toBe(true);
      expect(isValidDocumentId('12345678')).toBe(true);
    });

    it('rechaza un documento que empieza en cero', () => {
      expect(isValidDocumentId('0123456')).toBe(false);
      expect(isValidDocumentId('01234567')).toBe(false);
    });

    it('rechaza largos fuera de siete y ocho dígitos', () => {
      expect(isValidDocumentId('123456')).toBe(false);
      expect(isValidDocumentId('1234567890')).toBe(false);
    });
  });

  describe('CPF brasileño', () => {
    it.each(['111.444.777-35', '11144477735'])('acepta %s', (value) => {
      expect(isValidDocumentId(value)).toBe(true);
    });

    it('rechaza el segundo verificador equivocado', () => {
      expect(isValidDocumentId('111.444.777-36')).toBe(false);
    });

    it('rechaza los once dígitos repetidos', () => {
      for (let digit = 0; digit <= 9; digit++) {
        expect(isValidDocumentId(String(digit).repeat(11))).toBe(false);
      }
    });
  });

  describe('normalización', () => {
    it('rechaza cualquier carácter que no sea dígito, K ni separador de formato', () => {
      expect(isValidDocumentId('12.345.678-5A')).toBe(false);
      expect(isValidDocumentId('12/345/678-5')).toBe(false);
      expect(isValidDocumentId('RUT 12345678-5')).toBe(false);
    });

    it('rechaza un valor sin dígitos', () => {
      expect(isValidDocumentId('')).toBe(false);
      expect(isValidDocumentId('   ')).toBe(false);
      expect(isValidDocumentId('.-.')).toBe(false);
    });
  });
});

describe('documentIdValidator', () => {
  it('no reporta error sobre un documento válido de cada país', () => {
    expect(validate('12.345.678-5')).toBeNull();
    expect(validate('1234567')).toBeNull();
    expect(validate('111.444.777-35')).toBeNull();
  });

  it('reporta la clave de error sobre un documento inválido', () => {
    expect(validate('12.345.678-4')).toEqual({ [DOCUMENT_ID_ERROR_KEY]: true });
  });

  it('se abstiene con el control vacío y deja el caso a required', () => {
    expect(validate(null)).toBeNull();
    expect(validate(undefined)).toBeNull();
    expect(validate('')).toBeNull();
    expect(validate('   ')).toBeNull();
  });

  it('reporta error cuando el valor no es una cadena', () => {
    expect(validate(12_345_678)).toEqual({ [DOCUMENT_ID_ERROR_KEY]: true });
    expect(validate({ documentId: '12345678-5' })).toEqual({ [DOCUMENT_ID_ERROR_KEY]: true });
  });
});
