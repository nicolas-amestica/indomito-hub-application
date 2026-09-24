/**
 * Tests de propiedad del tramo final de los totales: utilidad, recargo y total.
 *
 * Cubren las propiedades 8, 9 y 10 del diseño, una por test y sin agrupar. El
 * tramo que verifican es el que fija el Requirement 8 en sus cuatro primeros
 * criterios, y su orden de operaciones no es intercambiable:
 *
 * ```text
 * netCLP            = round(netRaw)                                    (7.5)
 * utilityCLP        = ceil(netRaw × utilityRate / 100)                 (8.1)
 * netWithUtilityCLP = netCLP + utilityCLP                              (8.2)
 * totalCLP          = round(netWithUtilityCLP × (1 + rechargeRate/100))(8.3)
 * rechargeCLP       = totalCLP − netWithUtilityCLP                     (8.4)
 * ```
 *
 * Las dos rarezas de esa secuencia están heredadas del legacy a propósito: la
 * utilidad se calcula sobre el neto **sin redondear** pero se suma al neto
 * **redondeado**, y el recargo se obtiene **por diferencia** en vez de
 * multiplicando su porcentaje. Los tests transcriben esas fórmulas desde el
 * diseño y usan `round` y `ceil` de `rounding.ts`, en vez de volver a llamar a
 * `calculateProgram`: un test que contrastara el motor consigo mismo pasaría
 * igual si alguien reordenara las operaciones.
 *
 * El neto sin redondear se toma como dato de entrada de este tramo. Que ese
 * número esté bien construido a partir de los ítems es lo que verifican las
 * propiedades 6 y 7, en su propio archivo.
 *
 * Los ejemplos con valores escritos a mano viven en `calculation-engine.spec.ts`.
 *
 * Ver la sección "Correctness Properties" de `design.md`.
 */

import fc from 'fast-check';
import { FIELD_LIMITS } from '../constants/field-limits';
import { arbBoundedInt, arbCalculationInput, arbPositiveNetInput } from './__arbitraries__';
import { calculateProgram } from './calculation-engine';
import type { CalculationInput } from '../types/calculation.types';
import { ceil, round } from './rounding';

/** Iteraciones mínimas exigidas por la estrategia de testing del diseño. */
const NUM_RUNS = 100;

/**
 * Alza máxima que la Propiedad 10 aplica al precio de un ítem.
 *
 * El piso es 1 y no un centavo. Un alza de 0,01 en un ítem de tipo `fixed`
 * mueve el neto de un programa de 120 filas menos de lo que puede moverlo el
 * error de redondeo de sus propias sumas, y una iteración así no distinguiría un
 * motor monótono de uno que no lo es.
 */
const MAX_PRICE_INCREASE = 1000;

/** Un programa, el ítem cuyo precio se sube y cuánto se sube. */
interface PriceBumpSample {
  input: CalculationInput;
  /** Posición del ítem sobre la lista de tripulantes seguida de la de servicios. */
  itemIndex: number;
  increase: number;
}

/**
 * Programa con neto positivo, más el ítem al que se le sube el precio.
 *
 * Se apoya en `arbPositiveNetInput`, que garantiza al menos una fila: un programa
 * sin ítems no tiene precio que subir y la propiedad no diría nada sobre él. El
 * índice se sortea sobre las dos listas concatenadas para que la propiedad
 * alcance tanto a un tripulante como a un servicio de cualquiera de los cinco
 * tipos de cobro.
 */
function arbPriceBump(): fc.Arbitrary<PriceBumpSample> {
  return arbPositiveNetInput().chain((input) =>
    fc.record({
      input: fc.constant(input),
      itemIndex: fc.nat({ max: input.crews.length + input.services.length - 1 }),
      increase: arbBoundedInt(1, MAX_PRICE_INCREASE),
    }),
  );
}

/** Precio del ítem que ocupa esa posición, sea el diario de un tripulante o el unitario de un servicio. */
function itemPriceAt(input: CalculationInput, itemIndex: number): number {
  return itemIndex < input.crews.length
    ? input.crews[itemIndex].dailyPrice
    : input.services[itemIndex - input.crews.length].unitPrice;
}

/**
 * Devuelve el mismo programa con el precio de un solo ítem subido.
 *
 * El alza se acota al máximo declarado en `FIELD_LIMITS.itemPrice` para no salir
 * del rango que el formulario admite. Acotar con `Math.min` mantiene la
 * monotonía del propio generador —el precio nuevo nunca queda por debajo del
 * anterior— y el tope es entero, así que un ítem en CLP sigue cumpliendo el
 * Requirement 6.18 después del alza.
 */
function bumpItemPrice(sample: PriceBumpSample): CalculationInput {
  const { input, itemIndex, increase } = sample;
  const raise = (price: number): number => Math.min(price + increase, FIELD_LIMITS.itemPrice.max);

  if (itemIndex < input.crews.length) {
    return {
      ...input,
      crews: input.crews.map((crew, index) =>
        index === itemIndex ? { ...crew, dailyPrice: raise(crew.dailyPrice) } : crew,
      ),
    };
  }

  const serviceIndex = itemIndex - input.crews.length;
  return {
    ...input,
    services: input.services.map((service, index) =>
      index === serviceIndex ? { ...service, unitPrice: raise(service.unitPrice) } : service,
    ),
  };
}

describe('calculateProgram', () => {
  it('Feature: program-form, Property 8: Sin utilidad ni recargo, el total iguala el neto', () => {
    fc.assert(
      fc.property(
        // Las dos tasas se fuerzan en 0 sobre el `pricing` generado en vez de
        // filtrar las muestras que ya vengan en 0. Filtrar descartaría casi todas
        // las iteraciones —cada tasa recorre 0 a 100— y dejaría la propiedad
        // apoyada en un puñado de programas.
        arbCalculationInput().map((input) => ({
          ...input,
          pricing: { ...input.pricing, utilityRate: 0, rechargeRate: 0 },
        })),
        (input) => {
          const { totals, netRaw } = calculateProgram(input);

          // `ceil(0)` es 0, no 1: el redondeo hacia arriba de la utilidad no
          // introduce un peso cuando no hay utilidad que redondear
          // (Requirement 8.1). La igualdad es exacta, sin tolerancia.
          expect(totals.utilityCLP).toBe(ceil((netRaw * 0) / 100));
          expect(totals.utilityCLP).toBe(0);

          // Sin utilidad, el neto con utilidad es el neto (Requirement 8.2), y
          // sin recargo el total es el neto con utilidad (Requirement 8.3).
          expect(totals.netWithUtilityCLP).toBe(totals.netCLP);
          expect(totals.rechargeCLP).toBe(0);
          expect(totals.totalCLP).toBe(totals.netCLP);
          expect(totals.totalCLP).toBe(round(netRaw));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: program-form, Property 9: La descomposición del total cierra exacta', () => {
    fc.assert(
      fc.property(arbCalculationInput(), (input) => {
        const { totals, netRaw } = calculateProgram(input);
        const { utilityRate, rechargeRate } = input.pricing;

        // Fórmulas del Requirement 8, transcritas desde el diseño. La utilidad se
        // calcula sobre el neto **sin redondear** y el total sobre el neto con
        // utilidad, que ya es entero.
        expect(totals.utilityCLP).toBe(ceil((netRaw * utilityRate) / 100));
        expect(totals.netWithUtilityCLP).toBe(totals.netCLP + totals.utilityCLP);
        expect(totals.totalCLP).toBe(round(totals.netWithUtilityCLP * (1 + rechargeRate / 100)));

        // El cierre exacto. Vale por construcción **porque el recargo se obtiene
        // por diferencia**: quien lo recalculara como
        // `round(netWithUtilityCLP × rechargeRate / 100)` obtendría un número
        // plausible que en general no cierra, y este es el test que lo detecta.
        // Igualdad estricta, sin tolerancia: los tres montos son enteros y el
        // total que se le cobra al cliente no admite un peso de residuo.
        expect(totals.netCLP + totals.utilityCLP + totals.rechargeCLP).toBe(totals.totalCLP);

        // Ninguno de los dos márgenes puede restar: con las tasas en 0 valen 0, y
        // de ahí hacia arriba solo suman (Requirements 8.1 y 8.4).
        expect(totals.utilityCLP).toBeGreaterThanOrEqual(0);
        expect(totals.rechargeCLP).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: program-form, Property 10: El total es monótono creciente respecto del precio de cualquier ítem', () => {
    fc.assert(
      fc.property(arbPriceBump(), (sample) => {
        const { input, itemIndex } = sample;
        const bumped = bumpItemPrice(sample);

        // Que el alza sea efectivamente un alza es condición del generador, no de
        // la propiedad: sin esto un `raise` mal acotado dejaría el test verde por
        // comparar un programa contra sí mismo.
        expect(itemPriceAt(bumped, itemIndex)).toBeGreaterThanOrEqual(
          itemPriceAt(input, itemIndex),
        );

        const before = calculateProgram(input);
        const after = calculateProgram(bumped);

        // Monotonía **no estricta**, y no por prudencia. Con la utilidad y el
        // recargo en 0 el total es el neto redondeado, así que un alza que el
        // redondeo absorbe deja el total idéntico; y un ítem cuyo precio ya está
        // en el máximo de `FIELD_LIMITS.itemPrice` no admite alza alguna. Exigir
        // crecimiento estricto haría fallar el test por un comportamiento
        // correcto.
        expect(after.netRaw).toBeGreaterThanOrEqual(before.netRaw);
        expect(after.totals.netCLP).toBeGreaterThanOrEqual(before.totals.netCLP);
        expect(after.totals.netWithUtilityCLP).toBeGreaterThanOrEqual(
          before.totals.netWithUtilityCLP,
        );
        expect(after.totals.totalCLP).toBeGreaterThanOrEqual(before.totals.totalCLP);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
