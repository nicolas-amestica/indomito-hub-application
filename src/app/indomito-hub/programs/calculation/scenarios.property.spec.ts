import fc from 'fast-check';

import { arbScenarioCase } from './__arbitraries__';
import { MAX_SCENARIOS } from '../constants/scenario-defaults';
import { deriveScenarios } from './scenarios';

describe('deriveScenarios', () => {
  it('Feature: program-form, Property 15: Los escenarios derivados son válidos, acotados y distintos entre sí', () => {
    fc.assert(
      fc.property(arbScenarioCase(), ({ schedule, offsets }) => {
        const scenarios = deriveScenarios(schedule, offsets);
        const freeRatio = schedule.freePassengers / schedule.totalPassengers;
        const keys = scenarios.map(
          (scenario) => `${scenario.totalPassengers}:${scenario.freePassengers}`,
        );

        expect(scenarios.length).toBeGreaterThanOrEqual(1);
        expect(scenarios.length).toBeLessThanOrEqual(MAX_SCENARIOS);
        expect(new Set(keys).size).toBe(keys.length);

        for (const scenario of scenarios) {
          expect(scenario.totalPassengers).toBeGreaterThanOrEqual(1);
          expect(scenario.freePassengers).toBeGreaterThanOrEqual(0);
          expect(scenario.freePassengers).toBeLessThan(scenario.totalPassengers);
          expect(scenario.payingPassengers).toBe(
            scenario.totalPassengers - scenario.freePassengers,
          );
          expect(scenario.freePassengers).toBe(
            Math.min(
              Math.max(0, Math.round(scenario.totalPassengers * freeRatio)),
              scenario.totalPassengers - 1,
            ),
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});
