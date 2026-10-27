/**
 * Monto base de un ítem cobrable, según su tipo de cobro.
 *
 * Es la única traducción de la tabla "Monto base por tipo de cobro" de
 * `design.md` a código. Las seis fórmulas viven acá y en ningún otro lugar: el
 * resto del motor pide el monto base y no vuelve a multiplicar por días ni por
 * pasajeros.
 *
 * El monto base queda expresado **en la moneda del ítem**. Convertirlo a CLP es
 * trabajo de `calculateProgram`, que lo multiplica por la tasa efectiva.
 *
 * Funciones puras, sin dependencias de Angular.
 */

import type { ChargeType } from '../interfaces/program.interface';
import type { CrewInput, ScheduleInput, ServiceInput } from '../types/calculation.types';

/**
 * Un ítem que genera monto en el programa: un tripulante o un servicio. La unión
 * usa directamente las formas de entrada del motor, de modo que lo que producen
 * los generadores de `__arbitraries__/` se pasa a `baseAmount` sin adaptación.
 *
 * Se discrimina por la presencia de `chargeType`, que solo el servicio tiene: un
 * tripulante no elige tipo de cobro porque su fórmula es siempre la misma.
 */
export type ChargeableItem = CrewInput | ServiceInput;

/** Verdadero si el ítem es un tripulante. Estrecha el tipo para el llamador. */
export function isCrewItem(item: ChargeableItem): item is CrewInput {
  return !('chargeType' in item);
}

/**
 * Multiplicador que cada tipo de cobro aplica sobre el precio unitario.
 *
 * El multiplicador de pasajeros es `totalPassengers`, **con los liberados
 * incluidos** (Requirement 6.15). Un pasajero liberado igual duerme en el hotel
 * y entra al parque: lo que no hace es pagar, y de eso se ocupa el reparto por
 * persona, no esta fórmula.
 */
function serviceMultiplier(chargeType: ChargeType, schedule: ScheduleInput): number {
  switch (chargeType) {
    case 'fixed':
      return 1;
    case 'per_day':
      return schedule.totalDays;
    case 'per_passenger':
      return schedule.totalPassengers;
    case 'per_passenger_night':
      return schedule.totalPassengers * schedule.totalNights;
    case 'per_passenger_day':
      return schedule.totalPassengers * schedule.totalDays;
    default: {
      // Un sexto tipo de cobro deja de compilar acá hasta que se le dé fórmula.
      const unsupported: never = chargeType;
      throw new Error(`Tipo de cobro sin fórmula de monto base: ${String(unsupported)}`);
    }
  }
}

/**
 * Monto base del ítem en su propia moneda, según las seis fórmulas de la tabla
 * del diseño.
 *
 * | Ítem | Fórmula |
 * | --- | --- |
 * | Tripulante | `dailyPrice × totalDays` |
 * | `fixed` | `unitPrice` |
 * | `per_day` | `unitPrice × totalDays` |
 * | `per_passenger` | `unitPrice × totalPassengers` |
 * | `per_passenger_night` | `unitPrice × totalPassengers × totalNights` |
 * | `per_passenger_day` | `unitPrice × totalPassengers × totalDays` |
 *
 * Sin redondeo: el monto base conserva los decimales del precio unitario, porque
 * un servicio en USD se cotiza con centavos y redondear acá adelantaría una
 * pérdida de precisión que el neto ya resuelve una sola vez.
 *
 * Un rango de fechas invertido deja `totalDays` en 0 (Requirement 3.4) y con eso
 * los tipos que dependen de días dan 0, que es lo que corresponde: no hay
 * programa que cobrar.
 *
 * @param item Tripulante o servicio tal como el usuario lo ingresó.
 * @param schedule Cantidades del calendario ya derivadas.
 * @returns Monto base en la moneda del ítem.
 */
export function baseAmount(item: ChargeableItem, schedule: ScheduleInput): number {
  if (isCrewItem(item)) {
    // Requirement 5.8: el tripulante cobra por día de programa, no por pasajero.
    return item.dailyPrice * schedule.totalDays;
  }
  return item.unitPrice * serviceMultiplier(item.chargeType, schedule);
}
