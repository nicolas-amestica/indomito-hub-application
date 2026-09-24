/**
 * Generadores de los desplazamientos de escenario del presupuesto
 * (Requirement 13).
 *
 * Los duplicados que `deriveScenarios` debe descartar (Requirement 13.7) no
 * aparecen por coincidencia: se producen cuando varios desplazamientos negativos
 * grandes se acotan todos al mínimo de 1 pasajero, lo que exige un programa
 * pequeño y desplazamientos mayores que sus pasajeros. El generador construye esa
 * combinación a propósito en vez de esperarla.
 */

import fc from 'fast-check';
import { DEFAULT_SCENARIO_OFFSETS, MAX_SCENARIOS } from '../../constants/scenario-defaults';
import { FIELD_LIMITS } from '../../constants/field-limits';
import { arbBoundedInt, arbListSize } from './primitives';
import { type ScheduleSample, arbSchedule } from './schedule.arbitrary';

/** Un programa junto con desplazamientos correlacionados con su tamaño. */
export interface ScenarioCaseSample {
  schedule: ScheduleSample;
  offsets: number[];
}

/** Magnitud máxima de un desplazamiento generado. */
const OFFSET_SPAN = FIELD_LIMITS.totalPassengers.max + 20;

/** Pasajeros supuestos cuando quien llama no informa el tamaño del programa. */
const ASSUMED_PASSENGERS = 30;

/** Un desplazamiento suelto, con el 0 garantizado. */
function arbOffset(): fc.Arbitrary<number> {
  return fc.oneof(
    { arbitrary: fc.constantFrom(0, 1, -1, MAX_SCENARIOS, -OFFSET_SPAN, OFFSET_SPAN), weight: 2 },
    { arbitrary: arbBoundedInt(-OFFSET_SPAN, OFFSET_SPAN), weight: 3 },
  );
}

/**
 * Lista de desplazamientos de escenario. Alcanza la lista vacía, la de un solo
 * desplazamiento, las de más de cuatro, las que repiten un desplazamiento y las
 * que traen negativos de magnitud mayor que los pasajeros del programa.
 *
 * @param totalPassengers Pasajeros del programa al que se aplicarán. Determina
 *   qué negativo cuenta como "mayor que los pasajeros" y por lo tanto qué
 *   escenarios colapsan al acotarse.
 */
export function arbScenarioOffsets(
  totalPassengers: number = ASSUMED_PASSENGERS,
): fc.Arbitrary<number[]> {
  const beyondProgram = fc
    .integer({ min: totalPassengers, max: totalPassengers + 20 })
    .map((magnitude) => -magnitude);
  return fc.oneof(
    // Sin desplazamientos: el catálogo omitió el campo (Requirement 13.3).
    { arbitrary: fc.constant<number[]>([]), weight: 1 },
    // Los desplazamientos por defecto, que es el caso más frecuente en producción.
    { arbitrary: fc.constant<number[]>([...DEFAULT_SCENARIO_OFFSETS]), weight: 2 },
    // Un solo desplazamiento.
    { arbitrary: arbOffset().map((offset) => [offset]), weight: 2 },
    // El mismo desplazamiento repetido: duplicados antes de acotar.
    {
      arbitrary: fc
        .tuple(arbOffset(), fc.integer({ min: 2, max: 5 }))
        .map(([offset, times]) => Array.from({ length: times }, () => offset)),
      weight: 2,
    },
    // Negativos que exceden a los pasajeros del programa: todos colapsan a 1
    // pasajero y producen duplicados después de acotar.
    {
      arbitrary: fc.array(beyondProgram, { minLength: 2, maxLength: 6 }),
      weight: 2,
    },
    // Más de cuatro: obliga a recortar a MAX_SCENARIOS (Requirement 13.11).
    {
      arbitrary: fc.array(arbOffset(), { minLength: MAX_SCENARIOS + 1, maxLength: 10 }),
      weight: 2,
    },
    // Tramo general.
    {
      arbitrary: arbListSize(8).chain((size) =>
        fc.array(arbOffset(), { minLength: size, maxLength: size }),
      ),
      weight: 3,
    },
  );
}

/**
 * Programa y desplazamientos correlacionados. Es la entrada de la Propiedad 15:
 * sin la correlación, un programa de 100 pasajeros con desplazamientos de −10
 * nunca ejercita ni el acotamiento ni el descarte de duplicados.
 */
export function arbScenarioCase(): fc.Arbitrary<ScenarioCaseSample> {
  return arbSchedule().chain((schedule) =>
    fc.record({
      schedule: fc.constant(schedule),
      offsets: arbScenarioOffsets(schedule.totalPassengers),
    }),
  );
}
