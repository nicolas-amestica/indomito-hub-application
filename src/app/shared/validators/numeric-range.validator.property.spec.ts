/** Propiedad 16 de los rangos numéricos derivados de FIELD_LIMITS. */

import { FormControl } from '@angular/forms';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS } from '../../indomito-hub/programs/constants/field-limits';
import { type NumericLimit, numericRangeValidator } from './numeric-range.validator';

/** Campos del formulario que declaran un intervalo numérico cerrado. */
const RANGE_FIELDS: readonly { readonly field: string; readonly limit: NumericLimit }[] = [
  { field: 'totalDays', limit: FIELD_LIMITS.totalDays },
  { field: 'totalNights', limit: FIELD_LIMITS.totalNights },
  { field: 'totalPassengers', limit: FIELD_LIMITS.totalPassengers },
  { field: 'freePassengers', limit: FIELD_LIMITS.freePassengers },
  { field: 'usdIncreaseCLP', limit: FIELD_LIMITS.usdIncreaseCLP },
  { field: 'brlIncreaseCLP', limit: FIELD_LIMITS.brlIncreaseCLP },
  { field: 'utilityRate', limit: FIELD_LIMITS.utilityRate },
  { field: 'rechargeRate', limit: FIELD_LIMITS.rechargeRate },
  { field: 'itemPrice', limit: FIELD_LIMITS.itemPrice },
];

/** Valor general, interior o de frontera para el rango elegido. */
function arbFieldAndValue(): fc.Arbitrary<{ limit: NumericLimit; value: number }> {
  return fc
    .constantFrom(...RANGE_FIELDS)
    .chain(({ limit }) =>
      fc
        .oneof(
          fc.double(),
          fc.double({ min: limit.min, max: limit.max, noNaN: true, noDefaultInfinity: true }),
          fc.constantFrom(limit.min, limit.max, limit.min - 1, limit.max + 1),
        )
        .map((value) => ({ limit, value })),
    );
}

describe('numericRangeValidator · propiedad', () => {
  it('Feature: program-form, Property 16: La validez de un campo numérico equivale a pertenecer a su rango', () => {
    fc.assert(
      fc.property(arbFieldAndValue(), ({ limit, value }) => {
        const belongsToRange = value >= limit.min && value <= limit.max;
        const valid = numericRangeValidator(limit)(new FormControl(value)) === null;

        expect(valid).toBe(belongsToRange);
      }),
      { numRuns: 100 },
    );
  });
});
