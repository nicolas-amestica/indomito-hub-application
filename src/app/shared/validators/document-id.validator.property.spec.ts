/** Propiedad 18 del validador multinacional de documentos de identidad. */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbDocumentIdSample, arbMutatedDocumentId } from '../../features/programas/calculation/__arbitraries__';
import { isValidDocumentId } from './document-id.validator';

describe('isValidDocumentId · propiedad', () => {
  it('Feature: program-form, Property 18: El validador de documento acepta los válidos y rechaza los mutados', () => {
    fc.assert(
      fc.property(arbDocumentIdSample(), arbMutatedDocumentId(), (valid, mutated) => {
        expect(isValidDocumentId(valid.value)).toBe(true);
        expect(isValidDocumentId(mutated)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
