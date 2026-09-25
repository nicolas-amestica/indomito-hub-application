import { FormBuilder, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { getInvalidContractFields } from './get-invalid-contract-fields';

describe('getInvalidContractFields', () => {
  it('returns user-facing labels without duplicating array fields', () => {
    const fb = new FormBuilder();
    const form = fb.group({
      programId: ['', Validators.required],
      passengers: fb.array([
        fb.group({ names: ['', Validators.required] }),
        fb.group({ names: ['', Validators.required] }),
      ]),
    });

    expect(getInvalidContractFields(form)).toEqual(['Cotización guardada', 'Nombres del pasajero']);
  });
});
