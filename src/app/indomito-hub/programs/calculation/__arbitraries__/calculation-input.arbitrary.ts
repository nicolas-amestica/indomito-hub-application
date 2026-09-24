/**
 * Generadores de la entrada completa del motor de cálculo.
 *
 * El caso de neto 0 se genera de forma explícita. Es donde la fórmula de la
 * partición se indefine —divide por el neto sin redondear (Requirement 8.7)— y
 * donde el Requirement 8.8 obliga a un camino distinto. Sortear precios en
 * `[0,01, 99.999.999]` casi nunca produce una suma exacta de 0, así que esperar a
 * que aparezca por azar equivale a no probarlo.
 */

import fc from 'fast-check';
import type { CalculationInput } from '../../types/calculation.types';
import { DAY_DEPENDENT_CHARGE_TYPES, arbCrew, arbService } from './items.arbitrary';
import { arbListSize } from './primitives';
import { arbPricingSample } from './pricing.arbitrary';
import { arbInvertedSchedule, arbSchedule } from './schedule.arbitrary';

/** Tripulantes máximos que se generan: una tripulación grande de gira. */
export const MAX_GENERATED_CREWS = 20;

/** Servicios máximos que se generan: el tope declarado por el diseño. */
export const MAX_GENERATED_SERVICES = 100;

/**
 * Entrada de cálculo con al menos un ítem y con `totalDays` mayor que 0, de modo
 * que el neto sin redondear es estrictamente positivo. Es la entrada de toda
 * propiedad que divida por el neto.
 *
 * Alcanza una sola fila, la tripulación vacía con servicios, los servicios vacíos
 * con tripulación, y el par completo de 20 tripulantes y 100 servicios.
 */
export function arbPositiveNetInput(): fc.Arbitrary<CalculationInput> {
  return (
    fc
      .tuple(arbListSize(MAX_GENERATED_CREWS), arbListSize(MAX_GENERATED_SERVICES))
      // Las dos listas vacías dan neto 0, que es el otro generador. Acá se corrige
      // el sorteo en vez de descartarlo, para no perder iteraciones en el filtro.
      .map(([crews, services]) =>
        crews + services === 0 ? ([0, 1] as const) : ([crews, services] as const),
      )
      .chain(([crewCount, serviceCount]) =>
        fc.record({
          schedule: arbSchedule(),
          pricingSample: arbPricingSample(),
          crews: fc.array(arbCrew(), { minLength: crewCount, maxLength: crewCount }),
          services: fc.array(arbService(), { minLength: serviceCount, maxLength: serviceCount }),
        }),
      )
      .map(({ schedule, pricingSample, crews, services }) => ({
        schedule,
        pricing: pricingSample.pricing,
        rates: pricingSample.rates,
        crews,
        services,
      }))
  );
}

/**
 * Entrada de cálculo cuyo neto sin redondear es exactamente 0. Dos formas de
 * llegar, ambas alcanzables desde el formulario:
 *
 * 1. Sin tripulantes ni servicios. Es el estado inicial del formulario.
 * 2. Con un rango de fechas invertido, que deja `totalDays` en 0
 *    (Requirement 3.4), y solo ítems cuyo monto base multiplique por los días:
 *    tripulantes, `per_day` y `per_passenger_day`.
 */
export function arbZeroNetInput(): fc.Arbitrary<CalculationInput> {
  return fc.oneof(arbEmptyInput(), arbZeroDaysInput());
}

/** Programa sin filas: el estado del formulario recién abierto. */
function arbEmptyInput(): fc.Arbitrary<CalculationInput> {
  return fc.tuple(arbSchedule(), arbPricingSample()).map(([schedule, pricingSample]) => ({
    schedule,
    pricing: pricingSample.pricing,
    rates: pricingSample.rates,
    crews: [],
    services: [],
  }));
}

/** Programa con filas cuyo monto base es 0 porque el rango de fechas está invertido. */
function arbZeroDaysInput(): fc.Arbitrary<CalculationInput> {
  return fc
    .tuple(arbListSize(MAX_GENERATED_CREWS), arbListSize(MAX_GENERATED_SERVICES))
    .chain(([crewCount, serviceCount]) =>
      fc.record({
        schedule: arbInvertedSchedule(),
        pricingSample: arbPricingSample(),
        crews: fc.array(arbCrew(), { minLength: crewCount, maxLength: crewCount }),
        services: fc.array(
          fc
            .constantFrom(...DAY_DEPENDENT_CHARGE_TYPES)
            .chain((chargeType) => arbService(chargeType)),
          { minLength: serviceCount, maxLength: serviceCount },
        ),
      }),
    )
    .map(({ schedule, pricingSample, crews, services }) => ({
      schedule,
      pricing: pricingSample.pricing,
      rates: pricingSample.rates,
      crews,
      services,
    }));
}

/**
 * Entrada de cálculo general. Mezcla las entradas de neto positivo con las de
 * neto 0, reservando a estas últimas una fracción fija de las iteraciones en vez
 * de dejarlas al azar.
 */
export function arbCalculationInput(): fc.Arbitrary<CalculationInput> {
  return fc.oneof(
    { arbitrary: arbPositiveNetInput(), weight: 6 },
    { arbitrary: arbZeroNetInput(), weight: 1 },
  );
}
