import { BUDGET_SCENARIOS, MAX_SCENARIOS } from '../constants/scenario-defaults';
import { deriveScenarios } from './scenarios';

describe('deriveScenarios', () => {
  it('Feature: program-form, Property 15: Los escenarios fijos son válidos y distintos', () => {
    const scenarios = deriveScenarios();
    const keys = scenarios.map(
      (scenario) => `${scenario.totalPassengers}:${scenario.freePassengers}`,
    );

    expect(scenarios).toEqual(BUDGET_SCENARIOS);
    expect(scenarios).toHaveLength(MAX_SCENARIOS);
    expect(new Set(keys).size).toBe(keys.length);

    for (const scenario of scenarios) {
      expect(scenario.freePassengers).toBeLessThan(scenario.totalPassengers);
      expect(scenario.payingPassengers).toBe(
        scenario.totalPassengers - scenario.freePassengers,
      );
    }
  });
});
