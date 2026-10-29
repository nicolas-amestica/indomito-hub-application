import type { ScenarioShape } from '../interfaces/program.interface';

/** Escenarios comerciales fijos del presupuesto. Requirement 13.3. */
export const BUDGET_SCENARIOS: readonly ScenarioShape[] = [
  { totalPassengers: 20, freePassengers: 2, payingPassengers: 18 },
  { totalPassengers: 25, freePassengers: 2, payingPassengers: 23 },
  { totalPassengers: 30, freePassengers: 3, payingPassengers: 27 },
  { totalPassengers: 35, freePassengers: 3, payingPassengers: 32 },
  { totalPassengers: 40, freePassengers: 3, payingPassengers: 37 },
] as const;

/** Valor compatible con configuraciones persistidas anteriores; ya no define el PDF. */
export const DEFAULT_SCENARIO_OFFSETS = [-10, -5, 0, 5, 10] as const;

/** Cantidad máxima de escenarios que acepta el Budget_Pdf_Endpoint. Requirement 13.11. */
export const MAX_SCENARIOS = 5;
