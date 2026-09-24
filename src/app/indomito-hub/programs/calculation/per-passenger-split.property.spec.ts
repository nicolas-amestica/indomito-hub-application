import fc from 'fast-check';

import { arbCalculationInput, arbPositiveNetInput } from './__arbitraries__';
import { calculateProgram, derivePayingPassengers } from './calculation-engine';
import type { CalculationInput } from '../types/calculation.types';
import {
  independentAmountCLP,
  perPassengerPrice,
  splitAmount,
  type SplitContext,
} from './per-passenger-split';
import { ceil } from './rounding';

const NUM_RUNS = 100;

describe('perPassengerPrice', () => {
  it('Feature: program-form, Property 11: Las dos porciones suman el monto original', () => {
    fc.assert(
      fc.property(arbPositiveNetInput(), (input) => {
        const result = calculateProgram(input);
        const amount = result.totals.totalCLP;
        const { independentShare, dependentShare } = splitAmount(
          amount,
          splitContext(input, result),
        );

        expect(dependentShare).toBe(amount - independentShare);
        expect(independentShare + dependentShare).toBeCloseTo(amount, 6);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: program-form, Property 12: El precio por persona nunca recauda menos que el monto repartido', () => {
    fc.assert(
      fc.property(arbCalculationInput(), (input) => {
        const result = calculateProgram(input);
        const amount = result.totals.totalCLP;
        const price = perPassengerPrice(amount, splitContext(input, result));

        expect(price * input.schedule.totalPassengers).toBeGreaterThanOrEqual(amount);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: program-form, Property 13: Las dos ramas del reparto coinciden cuando no hay liberados', () => {
    fc.assert(
      fc.property(arbCalculationInput(), (sample) => {
        const input: CalculationInput = {
          ...sample,
          schedule: { ...sample.schedule, freePassengers: 0 },
        };
        const result = calculateProgram(input);
        const amount = result.totals.totalCLP;

        expect(perPassengerPrice(amount, splitContext(input, result))).toBe(
          ceil(amount / input.schedule.totalPassengers),
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

function splitContext(
  input: CalculationInput,
  result: ReturnType<typeof calculateProgram>,
): SplitContext {
  return {
    totalPassengers: input.schedule.totalPassengers,
    freePassengers: input.schedule.freePassengers,
    payingPassengers: derivePayingPassengers(
      input.schedule.totalPassengers,
      input.schedule.freePassengers,
    ),
    independentCLP: independentAmountCLP(result.rows),
    netRaw: result.netRaw,
  };
}
