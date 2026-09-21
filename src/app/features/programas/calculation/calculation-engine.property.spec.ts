/**
 * Tests de propiedad del calendario y de las tasas efectivas.
 *
 * Cubren las propiedades 1 a 4 del diseño, una por test y sin agrupar. Con un
 * solo motor de cálculo no hay segunda implementación que sirva de contraste, así
 * que cada propiedad se verifica contra los **datos de entrada** y no contra otra
 * función que aplique la misma fórmula:
 *
 * - La Propiedad 1 contrasta `deriveTotalDays` con el `offsetDays` que el
 *   generador conoce de antemano. Recalcular la diferencia con `addDaysIso` —la
 *   misma utilidad con la que el generador construyó `endDate`— probaría que dos
 *   copias de una aritmética coinciden, no que el motor cuente bien los días.
 * - La Propiedad 4 contrasta la tasa efectiva con `snapshot` y `pricing`, no con
 *   el `buildRates` de `pricing.arbitrary.ts`, que replica la fórmula del motor y
 *   convertiría el test en una comparación de dos implementaciones idénticas.
 *
 * Los ejemplos con valores escritos a mano viven en `calculation-engine.spec.ts`:
 * documentan la frontera concreta, mientras estos tests recorren el espacio.
 *
 * Ver la sección "Correctness Properties" de `design.md`.
 */

import fc from 'fast-check';
import { FIELD_LIMITS } from '../constants/field-limits';
import {
  arbDateRange,
  arbExchangeSnapshot,
  arbLimitInt,
  arbPricing,
  arbTotalPassengers,
  isoRangeContains,
} from './__arbitraries__';
import { buildEffectiveRates, derivePayingPassengers, deriveTotalDays } from './calculation-engine';

/** Iteraciones mínimas exigidas por la estrategia de testing del diseño. */
const NUM_RUNS = 100;

describe('deriveTotalDays', () => {
  it('Feature: program-form, Property 1: Los días totales cuentan ambos extremos del rango', () => {
    fc.assert(
      fc.property(
        arbDateRange().filter((range) => range.offsetDays >= 0),
        ({ startDate, endDate, offsetDays }) => {
          // `offsetDays` es el dato con el que el generador desplazó la fecha de
          // término, así que los días inclusive son ese desplazamiento más uno.
          // Que la igualdad valga para toda fecha de inicio —incluidos el 29 de
          // febrero, el cruce de año y los días de cambio de horario que el
          // generador produce a propósito— es lo que prueba que el conteo no
          // depende del tramo de calendario que atraviese el programa.
          const totalDays = deriveTotalDays(startDate, endDate);

          expect(totalDays).toBe(offsetDays + 1);
          expect(totalDays).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: program-form, Property 2: Un rango de fechas invertido anula los días', () => {
    fc.assert(
      fc.property(
        arbDateRange().filter((range) => range.offsetDays < 0),
        ({ startDate, endDate }) => {
          // Un rango invertido no contiene ni a su propia fecha de inicio: es la
          // forma de afirmar la inversión sin volver a restar las fechas.
          expect(isoRangeContains(startDate, endDate, startDate)).toBe(false);

          // El 0 es un centinela: la Propiedad 1 garantiza que ningún rango
          // válido lo produce, porque ahí el mínimo es 1. Eso es lo que permite
          // que el formulario invalide el campo de rango sin volver a comparar
          // las fechas (Requirement 3.4). La invalidez del control se verifica
          // sobre `date-range.validator.ts`, que es donde vive.
          expect(deriveTotalDays(startDate, endDate)).toBe(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('derivePayingPassengers', () => {
  it('Feature: program-form, Property 3: Los pasajeros pagantes nunca bajan de uno', () => {
    fc.assert(
      fc.property(
        arbTotalPassengers(),
        // Los liberados se generan sobre su rango declarado completo y no
        // acotados al total, porque el piso de 1 solo se ejerce cuando los
        // liberados alcanzan o superan a los pasajeros. Un generador coherente
        // con el formulario nunca llegaría a ese caso, que es justamente el que
        // el motor debe resistir sin depender de la validación (Requirement 3.9).
        arbLimitInt(FIELD_LIMITS.freePassengers),
        (totalPassengers, freePassengers) => {
          const payingPassengers = derivePayingPassengers(totalPassengers, freePassengers);

          expect(payingPassengers).toBeGreaterThanOrEqual(1);
          expect(payingPassengers).toBeLessThanOrEqual(totalPassengers);

          if (freePassengers < totalPassengers) {
            expect(payingPassengers).toBe(totalPassengers - freePassengers);
          } else {
            expect(payingPassengers).toBe(1);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('buildEffectiveRates', () => {
  it('Feature: program-form, Property 4: La tasa efectiva es la tasa del día más el incremento, y el CLP no se altera', () => {
    fc.assert(
      fc.property(arbPricing(), arbExchangeSnapshot(), (pricing, snapshot) => {
        const rates = buildEffectiveRates(pricing, snapshot);

        expect(rates.USD).toBe(snapshot.usdToClp + pricing.usdIncreaseCLP);
        expect(rates.BRL).toBe(snapshot.brlToClp + pricing.brlIncreaseCLP);

        // Un incremento nunca puede abaratar la divisa: es un resguardo de
        // margen, no un ajuste con signo (Requirement 4.6).
        expect(rates.USD).toBeGreaterThanOrEqual(snapshot.usdToClp);
        expect(rates.BRL).toBeGreaterThanOrEqual(snapshot.brlToClp);

        // El CLP no se convierte, cualquiera sea la combinación de incrementos
        // (Requirement 4.7).
        expect(rates.CLP).toBe(1);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
