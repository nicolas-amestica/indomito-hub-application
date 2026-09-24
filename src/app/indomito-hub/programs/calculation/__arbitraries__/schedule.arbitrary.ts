/**
 * Generadores del calendario del programa: rango de fechas, días, noches,
 * pasajeros y liberados.
 *
 * Las fechas de inicio no son aleatorias del todo. Un rango que cruce el 29 de
 * febrero o el fin de año se produce a propósito, porque son los dos casos donde
 * un cálculo de días hecho a mano se equivoca y un generador uniforme sobre diez
 * años casi nunca los toca.
 */

import fc from 'fast-check';
import { FIELD_LIMITS } from '../../constants/field-limits';
import type { ScheduleInput } from '../../types/calculation.types';
import { addDaysIso, arbBoundedInt } from './primitives';

/**
 * Calendario generado junto con el rango de fechas que lo produce. En los
 * calendarios de `arbSchedule` el rango es coherente con `totalDays`: contar
 * ambos extremos devuelve exactamente `totalDays` (Requirement 3.2). La
 * excepción es `arbInvertedSchedule`, cuyo rango está invertido a propósito y
 * cuyo `totalDays` es 0.
 */
export interface ScheduleSample extends ScheduleInput {
  /** ISO 8601. */
  startDate: string;
  /** ISO 8601. */
  endDate: string;
}

/** Rango de fechas generado, que puede estar invertido. */
export interface DateRangeSample {
  /** ISO 8601. */
  startDate: string;
  /** ISO 8601. Puede ser anterior a `startDate`. */
  endDate: string;
  /**
   * Días de `endDate` respecto de `startDate`. Negativo significa rango
   * invertido, que es el caso del Requirement 3.4. Se expone en vez del total de
   * días esperado para no encerrar la fórmula del motor dentro del generador.
   */
  offsetDays: number;
}

/** Primer día del rango desde el que se generan las fechas comunes. */
const EPOCH = '2020-01-01';

/** Días que abarca el rango de fechas comunes: once años. */
const EPOCH_SPAN_DAYS = 4017;

/**
 * Fechas de inicio elegidas para tocar los casos que el calendario hace
 * incómodos: el 29 de febrero de un año bisiesto, el mismo día en un año común
 * que no lo tiene, y diciembre, que fuerza el cruce de año en cuanto el programa
 * dura más de un día.
 */
const BOUNDARY_START_DATES: readonly string[] = [
  '2024-02-27',
  '2024-02-28',
  '2024-02-29',
  '2024-03-01',
  '2023-02-27',
  '2023-02-28',
  '2023-03-01',
  '2024-12-20',
  '2024-12-31',
  '2025-01-01',
  '2025-12-30',
];

/** Fecha de inicio: mezcla las fronteras del calendario con once años de fechas comunes. */
export function arbStartDate(): fc.Arbitrary<string> {
  return fc.oneof(
    { arbitrary: fc.constantFrom(...BOUNDARY_START_DATES), weight: 3 },
    {
      arbitrary: fc
        .integer({ min: 0, max: EPOCH_SPAN_DAYS })
        .map((offset) => addDaysIso(EPOCH, offset)),
      weight: 2,
    },
  );
}

/** Días totales del programa, con las fronteras de 1 y 100 garantizadas. */
export function arbTotalDays(): fc.Arbitrary<number> {
  return arbBoundedInt(FIELD_LIMITS.totalDays.min, FIELD_LIMITS.totalDays.max);
}

/**
 * Noches de estadía. Alcanza los dos valores con significado de negocio —el
 * precargado `totalDays − 1` y el de la gira con bus nocturno, donde las noches
 * igualan a los días (Requirement 3.13)— además del rango completo, porque el
 * campo es sobrescribible.
 */
export function arbTotalNights(totalDays: number): fc.Arbitrary<number> {
  const { min, max } = FIELD_LIMITS.totalNights;
  const preloaded = Math.min(Math.max(min, totalDays - 1), max);
  const sameAsDays = Math.min(Math.max(min, totalDays), max);
  return fc.oneof(
    { arbitrary: fc.constantFrom(preloaded, sameAsDays), weight: 3 },
    { arbitrary: arbBoundedInt(min, max), weight: 2 },
  );
}

/** Pasajeros totales, con las fronteras de 1 y 100 garantizadas. */
export function arbTotalPassengers(): fc.Arbitrary<number> {
  return arbBoundedInt(FIELD_LIMITS.totalPassengers.min, FIELD_LIMITS.totalPassengers.max);
}

/**
 * Pasajeros liberados de un programa de `totalPassengers` pasajeros. Nunca llega
 * a `totalPassengers`: el Requirement 3.7 exige que quede al menos un pagante, y
 * generar el caso imposible solo produciría contraejemplos que la interfaz no
 * puede construir.
 */
export function arbFreePassengers(totalPassengers: number): fc.Arbitrary<number> {
  const { min, max } = FIELD_LIMITS.freePassengers;
  const ceiling = Math.min(totalPassengers - 1, max);
  if (ceiling <= min) return fc.constant(min);
  return arbBoundedInt(min, ceiling);
}

/**
 * Calendario completo y coherente. Alcanza 1 día, 100 días, cruce de año, el 29
 * de febrero, 1 pasajero y liberados en `totalPassengers − 1`.
 */
export function arbSchedule(): fc.Arbitrary<ScheduleSample> {
  return fc
    .tuple(arbStartDate(), arbTotalDays(), arbTotalPassengers())
    .chain(([startDate, totalDays, totalPassengers]) =>
      fc.record({
        startDate: fc.constant(startDate),
        endDate: fc.constant(addDaysIso(startDate, totalDays - 1)),
        totalDays: fc.constant(totalDays),
        totalNights: arbTotalNights(totalDays),
        totalPassengers: fc.constant(totalPassengers),
        freePassengers: arbFreePassengers(totalPassengers),
      }),
    );
}

/**
 * Calendario con `totalDays` en 0, que es lo que deja un rango de fechas
 * invertido (Requirement 3.4). Todo ítem cuyo monto base multiplique por los
 * días vale 0 en este calendario, y de ahí sale el caso de neto 0.
 */
export function arbInvertedSchedule(): fc.Arbitrary<ScheduleSample> {
  return fc
    .tuple(arbStartDate(), arbBoundedInt(1, FIELD_LIMITS.totalDays.max), arbTotalPassengers())
    .chain(([startDate, gap, totalPassengers]) =>
      fc.record({
        startDate: fc.constant(startDate),
        endDate: fc.constant(addDaysIso(startDate, -gap)),
        totalDays: fc.constant(0),
        totalNights: arbBoundedInt(FIELD_LIMITS.totalNights.min, FIELD_LIMITS.totalNights.max),
        totalPassengers: fc.constant(totalPassengers),
        freePassengers: arbFreePassengers(totalPassengers),
      }),
    );
}

/**
 * Rango de fechas que puede estar invertido. Alcanza el rango de un solo día
 * (`offsetDays` en 0), el de 100 días (99) y los invertidos (negativos),
 * empezando por el que se invierte por un solo día.
 */
export function arbDateRange(): fc.Arbitrary<DateRangeSample> {
  const span = FIELD_LIMITS.totalDays.max - 1;
  const offsets = fc.oneof(
    // Las fronteras con nombre: un día, dos días, cien días, invertido por un día
    // e invertido al máximo. `arbBoundedInt` sobre un rango con signo gasta sus
    // extremos en los negativos grandes y dejaría el 0 al azar.
    { arbitrary: fc.constantFrom(0, 1, span, -1, -span), weight: 3 },
    { arbitrary: fc.integer({ min: -span, max: span }), weight: 2 },
  );
  return fc.tuple(arbStartDate(), offsets).map(([startDate, offsetDays]) => ({
    startDate,
    endDate: addDaysIso(startDate, offsetDays),
    offsetDays,
  }));
}
