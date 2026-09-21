/**
 * Test de propiedad del monto base por tipo de cobro (Propiedad 5 del diseño).
 *
 * Los ejemplos de las seis fórmulas están en `charge-type.spec.ts`. Acá se
 * verifica el enunciado universal sobre todo el espacio de entrada: cualquier
 * ítem, cualquiera sea su tipo de cobro, contra cualquier combinación de días,
 * noches y pasajeros dentro de los rangos declarados.
 *
 * **Sobre la autorreferencia.** El multiplicador esperado se escribe acá de
 * nuevo, transcrito de la tabla "Monto base por tipo de cobro" de `design.md` y
 * de los criterios 6.6 a 6.10, en vez de importarse del módulo bajo prueba.
 * Reusar el multiplicador de `charge-type.ts` haría que el test ejecutara dos
 * veces el mismo código y pasara incluso con la fórmula equivocada.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ChargeType } from '../interfaces/program.interface';
import { arbCrew, arbSchedule, arbService } from './__arbitraries__';
import type { CrewInput, ScheduleInput, ServiceInput } from './calculation.types';
import { type ChargeableItem, baseAmount, isCrewItem } from './charge-type';

/**
 * Multiplicador que el diseño asigna a cada tipo de cobro. Segunda escritura
 * deliberada de la tabla del diseño: es el valor con el que se contrasta lo que
 * devuelve el motor.
 *
 * El multiplicador de pasajeros es `totalPassengers`, con los liberados
 * incluidos (Requirement 6.15). Al ser producto de enteros, el resultado es
 * exacto y el contraste puede exigir igualdad estricta en vez de una tolerancia.
 */
const EXPECTED_MULTIPLIER: Record<ChargeType, (schedule: ScheduleInput) => number> = {
  // Requirement 6.6: el precio unitario, sin multiplicar.
  fixed: () => 1,
  // Requirement 6.9: por los días totales.
  per_day: (schedule) => schedule.totalDays,
  // Requirement 6.7: por la cantidad de pasajeros.
  per_passenger: (schedule) => schedule.totalPassengers,
  // Requirement 6.8: por los pasajeros y por las noches de estadía.
  per_passenger_night: (schedule) => schedule.totalPassengers * schedule.totalNights,
  // Requirement 6.10: por los pasajeros y por los días totales.
  per_passenger_day: (schedule) => schedule.totalPassengers * schedule.totalDays,
};

/** Los tres tipos de cobro cuyo multiplicador incluye a los pasajeros (Requirement 6.15). */
const PASSENGER_DEPENDENT_CHARGE_TYPES: readonly ChargeType[] = [
  'per_passenger',
  'per_passenger_night',
  'per_passenger_day',
];

/** El mismo ítem con el precio escalado, sin tocar ningún otro campo. */
function withScaledPrice(item: ChargeableItem, factor: number): ChargeableItem {
  return isCrewItem(item)
    ? ({ ...item, dailyPrice: item.dailyPrice * factor } satisfies CrewInput)
    : ({ ...item, unitPrice: item.unitPrice * factor } satisfies ServiceInput);
}

/**
 * Monto base que el diseño exige para el ítem, calculado de forma independiente
 * del motor: precio del ítem por el multiplicador de su tipo. El tripulante no
 * elige tipo de cobro, su fórmula es siempre `dailyPrice × totalDays`
 * (Requirement 5.8).
 */
function expectedBaseAmount(item: ChargeableItem, schedule: ScheduleInput): number {
  if (isCrewItem(item)) return item.dailyPrice * schedule.totalDays;
  return item.unitPrice * EXPECTED_MULTIPLIER[item.chargeType](schedule);
}

/**
 * Ítem cobrable del programa. El servicio pesa cuatro veces más que el
 * tripulante porque reparte su probabilidad entre cinco tipos de cobro: con esta
 * proporción las seis fórmulas reciben una fracción parecida de las iteraciones.
 */
function arbChargeableItem(): fc.Arbitrary<ChargeableItem> {
  const crew: fc.Arbitrary<ChargeableItem> = arbCrew();
  const service: fc.Arbitrary<ChargeableItem> = arbService();
  return fc.oneof({ arbitrary: crew, weight: 1 }, { arbitrary: service, weight: 4 });
}

describe('baseAmount · propiedades', () => {
  // Feature: program-form, Property 5: El monto base corresponde a la fórmula de su tipo de cobro
  it('el monto base es el precio del item por el multiplicador de su tipo', () => {
    fc.assert(
      fc.property(arbSchedule(), arbChargeableItem(), (schedule, item) => {
        const amount = baseAmount(item, schedule);

        // La fórmula misma: precio por el multiplicador que define el tipo.
        expect(amount).toBe(expectedBaseAmount(item, schedule));

        // El multiplicador no depende del precio: doblarlo dobla el monto base.
        // Escalar por una potencia de dos es exacto en punto flotante, así que la
        // igualdad estricta no depende del orden de los factores.
        expect(baseAmount(withScaledPrice(item, 2), schedule)).toBe(amount * 2);

        // Requirement 6.15: el multiplicador cuenta a los pasajeros liberados.
        // Recalcular con solo los pagantes tiene que dar menos, porque el precio
        // parte en 0,01 y las noches y los días parten en 1.
        const onlyPaying: ScheduleInput = {
          ...schedule,
          totalPassengers: schedule.totalPassengers - schedule.freePassengers,
        };
        const countsFreePassengers =
          !isCrewItem(item) &&
          schedule.freePassengers > 0 &&
          PASSENGER_DEPENDENT_CHARGE_TYPES.includes(item.chargeType);
        if (countsFreePassengers) {
          expect(amount).toBeGreaterThan(baseAmount(item, onlyPaying));
        }
      }),
      { numRuns: 100 },
    );
  });
});
