/**
 * Generadores de `fast-check` de la feature `program-form`.
 *
 * Son la pieza que decide si los tests de propiedad sirven. Todos siguen el mismo
 * criterio: reservan parte de su probabilidad a las fronteras del dominio en vez
 * de sortear valores promedio, porque una propiedad que solo falla en el borde
 * puede pasar cien iteraciones de un generador uniforme sin enterarse.
 *
 * Este directorio es **solo de tests**: está excluido de `tsconfig.app.json`, así
 * que `fast-check` no puede llegar al paquete de la aplicación.
 *
 * Ver la tabla "Generadores" de `design.md` y la tarea 3.1 de `tasks.md`.
 */

export {
  MAX_GENERATED_CREWS,
  MAX_GENERATED_SERVICES,
  arbCalculationInput,
  arbPositiveNetInput,
  arbZeroNetInput,
} from './calculation-input.arbitrary';
export { arbCatalogSettings, arbMarginDefaults } from './catalog-settings.arbitrary';
export {
  type DocumentIdSample,
  type DocumentKind,
  arbCpf,
  arbDni,
  arbDocumentId,
  arbDocumentIdSample,
  arbMutatedDocumentId,
  arbRut,
  cpfCheckDigits,
  isValidCpf,
  isValidRut,
  rutCheckDigit,
} from './document-id.arbitrary';
export {
  DAY_DEPENDENT_CHARGE_TYPES,
  arbChargeType,
  arbCrew,
  arbCurrency,
  arbItemName,
  arbItemPrice,
  arbService,
} from './items.arbitrary';
export {
  NAME_LETTERS,
  NAME_TEXT,
  WHITESPACE,
  addDaysIso,
  arbBoundedInt,
  arbLimitInt,
  arbListSize,
  arbSteppedInt,
  arbTextOf,
  groupThousands,
  isoRangeContains,
  toIsoDate,
} from './primitives';
export {
  type PricingSample,
  arbEffectiveRates,
  arbExchangeSnapshot,
  arbPricing,
  arbPricingSample,
  buildRates,
} from './pricing.arbitrary';
export {
  arbBlankProgramName,
  arbProgramName,
  arbProgramNameOfTrimmedLength,
} from './program-name.arbitrary';
export {
  type DateRangeSample,
  type ScheduleSample,
  arbDateRange,
  arbFreePassengers,
  arbInvertedSchedule,
  arbSchedule,
  arbStartDate,
  arbTotalDays,
  arbTotalNights,
  arbTotalPassengers,
} from './schedule.arbitrary';
export {
  type ScenarioCaseSample,
  arbScenarioCase,
  arbScenarioOffsets,
} from './scenarios.arbitrary';
