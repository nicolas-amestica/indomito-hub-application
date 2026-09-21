import fc from 'fast-check';

import { arbCalculationInput, arbScenarioOffsets } from './__arbitraries__';
import { calculateProgram } from './calculation-engine';
import { calculateScenario, deriveScenarios } from './scenarios';

describe('calculateScenario', () => {
  it('Feature: program-form, Property 14: Cada escenario reutiliza el motor con sus cantidades derivadas', () => {
    fc.assert(
      fc.property(arbCalculationInput(), arbScenarioOffsets(), (input, offsets) => {
        for (const scenario of deriveScenarios(input.schedule, offsets)) {
          const expected = calculateProgram({
            ...input,
            schedule: {
              ...input.schedule,
              totalPassengers: scenario.totalPassengers,
              freePassengers: scenario.freePassengers,
            },
          });

          expect(calculateScenario(input, scenario)).toEqual(expected);
        }
      }),
      { numRuns: 100 },
    );
  });
});
