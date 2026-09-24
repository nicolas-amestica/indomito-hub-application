import { DEFAULT_SCENARIO_OFFSETS, MAX_SCENARIOS } from '../constants/scenario-defaults';
import type { ScenarioShape } from '../interfaces/program.interface';
import { calculateProgram, type CalculationResult } from './calculation-engine';
import type { CalculationInput, ScheduleInput } from '../types/calculation.types';

/**
 * Deriva las cantidades de cada escenario a partir de las del programa.
 *
 * El orden es deliberado: desplaza, acota el total, calcula y acota los liberados,
 * y recién entonces elimina duplicados. Así, dos desplazamientos negativos que
 * colapsan al mismo total mínimo producen una sola columna en el presupuesto.
 *
 * @param schedule Cantidades del programa original.
 * @param offsets Desplazamientos configurados; una lista vacía usa el respaldo del frontend.
 */
export function deriveScenarios(
  schedule: ScheduleInput,
  offsets: readonly number[] = DEFAULT_SCENARIO_OFFSETS,
): ScenarioShape[] {
  const selectedOffsets = offsets.length > 0 ? offsets : DEFAULT_SCENARIO_OFFSETS;
  const freeRatio =
    schedule.totalPassengers > 0 ? schedule.freePassengers / schedule.totalPassengers : 0;
  const seen = new Set<string>();
  const scenarios: ScenarioShape[] = [];

  for (const offset of selectedOffsets) {
    const totalPassengers = Math.max(1, schedule.totalPassengers + offset);
    const freePassengers = Math.min(
      Math.max(0, Math.round(totalPassengers * freeRatio)),
      totalPassengers - 1,
    );
    const key = `${totalPassengers}:${freePassengers}`;
    if (seen.has(key)) continue;

    seen.add(key);
    scenarios.push({
      totalPassengers,
      freePassengers,
      payingPassengers: totalPassengers - freePassengers,
    });

    if (scenarios.length === MAX_SCENARIOS) break;
  }

  return scenarios;
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
