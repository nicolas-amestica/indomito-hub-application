/** Propiedad 17 del nombre recortado del programa. */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbProgramName } from '../calculation/__arbitraries__';
import { FIELD_LIMITS } from '../constants/field-limits';
import { buildProgramForm } from './program-form.builder';

describe('nombre del programa · propiedad', () => {
  it('Feature: program-form, Property 17: La validez del nombre equivale a su largo mínimo', () => {
    const nameControl = buildProgramForm(() => 'row-id').controls.generals.controls.name;

    fc.assert(
      fc.property(arbProgramName(), (name) => {
        nameControl.setValue(name);

        expect(nameControl.valid).toBe(name.trim().length >= FIELD_LIMITS.nameMinLength);
      }),
      { numRuns: 100 },
    );
  });
});
