import { BUDGET_SCENARIOS } from '../constants/scenario-defaults';
import type { ScenarioShape } from '../interfaces/program.interface';
import { calculateProgram, type CalculationResult } from './calculation-engine';
import type { CalculationInput } from '../types/calculation.types';

/** Devuelve los cinco escenarios comerciales fijos del presupuesto. */
export function deriveScenarios(): ScenarioShape[] {
  return BUDGET_SCENARIOS.map((scenario) => ({ ...scenario }));
}

/**
 * Recalcula el programa con las cantidades de un escenario, reutilizando el único motor.
 *
 * Los servicios dependientes de pasajeros cambian porque `calculateProgram` vuelve a
 * evaluar su multiplicador; los ítems fijos y por día conservan su monto base.
 */
export function calculateScenario(
  input: CalculationInput,
  scenario: ScenarioShape,
): CalculationResult {
  return calculateProgram({
    ...input,
    schedule: {
      ...input.schedule,
      totalPassengers: scenario.totalPassengers,
      freePassengers: scenario.freePassengers,
    },
  });
}
