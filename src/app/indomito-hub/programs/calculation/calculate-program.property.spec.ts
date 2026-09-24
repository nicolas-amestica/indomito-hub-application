/**
 * Tests de propiedad de la conversión a pesos y del neto del programa.
 *
 * Cubren las propiedades 6 y 7 del diseño, una por test y sin agrupar. Las dos
 * verifican `calculateProgram` sobre el espacio completo de entrada: monedas
 * mezcladas, listas vacías, una sola fila, y el par de 20 tripulantes con 100
 * servicios que es el tope del programa.
 *
 * **Sobre la autorreferencia.** Ninguna de las dos importa una segunda copia de
 * la fórmula del motor:
 *
 * - La Propiedad 6 recompone el neto desde `totals.subtotalCLP/USD/BRL` y
 *   `input.rates`, que son datos —la salida que la tabla muestra en el pie y las
 *   tasas que el propio caso generó—, y lo contrasta además por una vía distinta:
 *   la suma de los `amountCLP` fila por fila. Que las dos rutas coincidan es lo
 *   que hace verificable la exhaustividad: un ítem contado dos veces o omitido
 *   rompe una de las dos y no la otra.
 * - La Propiedad 7 no calcula nada por su cuenta. Compara el motor consigo mismo
 *   sobre dos ordenamientos de la misma entrada, que es exactamente el enunciado.
 *
 * **Sobre las tolerancias.** Las igualdades que el diseño define como exactas se
 * afirman con `toBe`, no con `toBeCloseTo`. El neto se define como la suma de los
 * tres subtotales convertidos en el orden CLP, USD, BRL, y los subtotales se
 * acumulan de forma independiente del orden de los ítems: ambas cosas valen bit a
 * bit, y una tolerancia dejaría pasar justamente el defecto que estos tests
 * existen para detectar. La única comparación con tolerancia es la de la ruta
 * alternativa fila por fila, que reasocia la suma a propósito.
 *
 * Ver la sección "Correctness Properties" de `design.md`.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CurrencyCode, SummaryRow } from '../interfaces/program.interface';
import { arbCalculationInput } from './__arbitraries__';
import type { CalculationInput } from '../types/calculation.types';
import { calculateProgram } from './calculation-engine';

/** Iteraciones mínimas exigidas por la estrategia de testing del diseño. */
const NUM_RUNS = 100;

/** Las tres monedas del programa, en el orden en que el neto las compone. */
const CURRENCIES: readonly CurrencyCode[] = ['CLP', 'USD', 'BRL'];

/**
 * Tolerancia **relativa** de la única comparación que reasocia una suma de punto
 * flotante: la del neto contra la suma de los `amountCLP` fila por fila.
 *
 * Es relativa y no absoluta porque el neto de un programa recorre doce órdenes de
 * magnitud —desde un servicio de 0,01 dólares hasta 100 servicios de 99.999.999
 * pesos por 100 pasajeros—, y una tolerancia fija sería a la vez inútil en el
 * extremo alto e imposible en el bajo.
 *
 * El margen es holgado frente al error real, que con 120 términos no negativos y
 * doble precisión queda del orden de 1e-14 relativo, y sigue siendo mucho más
 * estrecho que cualquier ítem omitido o contado dos veces, cuyo aporte mínimo es
 * un céntimo.
 */
const RELATIVE_EPSILON = 1e-9;

/**
 * Afirma que dos montos coinciden salvo el error de reasociar la suma.
 *
 * @param actual Monto obtenido por la ruta alternativa.
 * @param expected Monto que el motor produjo.
 */
function expectRelativelyClose(actual: number, expected: number): void {
  const tolerance = RELATIVE_EPSILON * Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

/**
 * Reparte los montos base de las filas según su moneda.
 *
 * El reparto es lo que le da sentido a la palabra "partición" del enunciado: cada
 * fila cae en exactamente un grupo, porque `row.currency` es un solo valor, y la
 * suma de los tamaños de los tres grupos tiene que devolver la cantidad de filas.
 */
function baseAmountsByCurrency(rows: readonly SummaryRow[]): Record<CurrencyCode, number[]> {
  const buckets: Record<CurrencyCode, number[]> = { CLP: [], USD: [], BRL: [] };
  for (const row of rows) buckets[row.currency].push(row.baseAmount);
  return buckets;
}

/**
 * Suma los montos de menor a mayor.
 *
 * Es la suma que los Requirements 7.2 a 7.4 piden —el subtotal de una moneda es
 * la suma de los montos base de sus ítems— escrita de forma que no dependa del
 * orden en que las filas llegaron. Ordenar antes de sumar hace de la suma una
 * función del conjunto de valores: dos ordenamientos del mismo grupo producen el
 * mismo arreglo y, por lo tanto, exactamente el mismo número. Eso es lo que
 * permite contrastar los subtotales con `toBe` en vez de una tolerancia.
 */
function sumAscending(values: readonly number[]): number {
  return [...values].sort((first, second) => first - second).reduce((sum, value) => sum + value, 0);
}

/**
 * Firma canónica de los ítems de una entrada: el multiconjunto de las filas,
 * ordenado y por lo tanto independiente del orden en que se ingresaron.
 *
 * Sirve para afirmar que lo que la Propiedad 7 compara es de verdad una
 * permutación y no otra lista. Sin esta guarda, un generador que perdiera o
 * duplicara una fila haría fallar el test por el motivo equivocado, o —peor— lo
 * haría pasar comparando la entrada consigo misma.
 */
function itemSignatures(input: CalculationInput): string[] {
  return [
    ...input.crews.map((crew) => `crew|${crew.currency}|${crew.dailyPrice}|${crew.name}`),
    ...input.services.map(
      (service) =>
        `service|${service.currency}|${service.chargeType}|${service.unitPrice}|${service.name}`,
    ),
  ].sort();
}

/**
 * Permutación de una lista. Con listas de un elemento o vacías devuelve la única
 * que existe, que es la lista misma: son entradas legítimas del programa —el
 * formulario recién abierto no tiene filas— y descartarlas gastaría iteraciones
 * sin ganar nada.
 */
function arbPermutation<T>(items: readonly T[]): fc.Arbitrary<T[]> {
  if (items.length === 0) return fc.constant<T[]>([]);
  return fc.shuffledSubarray([...items], {
    minLength: items.length,
    maxLength: items.length,
  });
}

/** La misma entrada con las dos listas permutadas de forma independiente. */
function withPermutedItems(input: CalculationInput): fc.Arbitrary<CalculationInput> {
  return fc
    .record({
      crews: arbPermutation(input.crews),
      services: arbPermutation(input.services),
    })
    .map(({ crews, services }) => ({ ...input, crews, services }));
}

/** La misma entrada con las dos listas invertidas. */
function withReversedItems(input: CalculationInput): CalculationInput {
  return { ...input, crews: [...input.crews].reverse(), services: [...input.services].reverse() };
}

describe('calculateProgram · conversión y neto', () => {
  it('Feature: program-form, Property 6: Los subtotales por moneda forman una partición exhaustiva del neto', () => {
    fc.assert(
      fc.property(arbCalculationInput(), (input) => {
        const { rows, totals, netRaw } = calculateProgram(input);

        // Nada omitido ni contado dos veces al nivel de la fila: una fila por
        // tripulante y una por servicio (Requirement 6.18 fija los topes de 20 y
        // 100, que el generador alcanza).
        expect(rows).toHaveLength(input.crews.length + input.services.length);

        // La partición propiamente tal: cada fila cae en el grupo de una sola
        // moneda, y los tres grupos agotan las filas.
        const buckets = baseAmountsByCurrency(rows);
        const bucketedCount = CURRENCIES.reduce((count, code) => count + buckets[code].length, 0);
        expect(bucketedCount).toBe(rows.length);

        // Requirements 7.2 a 7.4: cada subtotal es la suma de los montos base de
        // su moneda, expresada en esa moneda y no en pesos. Exacto: el motor y
        // esta suma recorren el mismo grupo en el mismo orden ascendente.
        expect(totals.subtotalCLP).toBe(sumAscending(buckets.CLP));
        expect(totals.subtotalUSD).toBe(sumAscending(buckets.USD));
        expect(totals.subtotalBRL).toBe(sumAscending(buckets.BRL));

        // El enunciado de la propiedad: los tres subtotales convertidos con su
        // tasa efectiva agotan el neto sin redondear. Los términos se componen en
        // el orden CLP, USD, BRL, que es el orden en que el diseño define el
        // neto, así que la igualdad vale bit a bit y no dentro de una tolerancia.
        const expectedNetRaw =
          totals.subtotalCLP * input.rates.CLP +
          totals.subtotalUSD * input.rates.USD +
          totals.subtotalBRL * input.rates.BRL;
        expect(netRaw).toBe(expectedNetRaw);

        // Ruta independiente, y la que hace no vacía a la exhaustividad: el mismo
        // neto convirtiendo fila por fila (Requirement 7.1) en vez de por moneda
        // (Requirement 7.5). Reasocia la suma a propósito, de ahí la tolerancia
        // relativa; un ítem duplicado u omitido la excede por muchos órdenes de
        // magnitud.
        const netFromRows = rows.reduce((sum, row) => sum + row.amountCLP, 0);
        expectRelativelyClose(netFromRows, netRaw);

        // Requirement 7.1: el monto en CLP de cada fila es su monto base por la
        // tasa efectiva de su moneda, y el CLP no se convierte (Requirement 4.7).
        for (const row of rows) {
          expect(row.effectiveRate).toBe(input.rates[row.currency]);
          expect(row.amountCLP).toBe(row.baseAmount * input.rates[row.currency]);
        }

        // Requirement 7.5: el neto que la pantalla muestra es el redondeado.
        expect(totals.netCLP).toBe(Math.round(netRaw));

        // Ningún ítem resta: los precios parten en 0,01 y las tasas efectivas en
        // 1, así que el neto de un programa nunca puede ser negativo.
        expect(netRaw).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: program-form, Property 7: El neto es invariante frente al orden de los ítems', () => {
    fc.assert(
      fc.property(
        arbCalculationInput().chain((input) =>
          withPermutedItems(input).map((permuted) => ({ input, permuted })),
        ),
        ({ input, permuted }) => {
          // Guarda del generador: lo que se compara es la misma lista en otro
          // orden. Si esto falla, el defecto está en el test y no en el motor.
          expect(itemSignatures(permuted)).toEqual(itemSignatures(input));

          const original = calculateProgram(input);

          // El enunciado: el neto de cualquier permutación es idéntico. `toBe` y
          // no `toBeCloseTo` a propósito. La suma de punto flotante no es
          // asociativa, así que esta igualdad exacta solo se sostiene mientras el
          // motor acumule los subtotales de forma independiente del orden. Con
          // una tolerancia, quitar esa acumulación no rompería ningún test y el
          // neto de un programa pasaría a depender de en qué orden se tipearon
          // sus filas (Requirement 7.5).
          for (const shuffled of [
            calculateProgram(permuted),
            // La inversión completa se agrega como permutación garantizada: con
            // dos o más filas es distinta de la identidad, que es algo que el
            // sorteo no puede prometer en cada iteración.
            calculateProgram(withReversedItems(input)),
          ]) {
            expect(shuffled.netRaw).toBe(original.netRaw);
            expect(shuffled.totals.netCLP).toBe(original.totals.netCLP);

            // Los tres subtotales son el insumo del neto: si alguno dependiera
            // del orden, el neto lo heredaría. Afirmarlos acá localiza el defecto
            // en la moneda que lo tenga en vez de dejarlo en el agregado.
            expect(shuffled.totals.subtotalCLP).toBe(original.totals.subtotalCLP);
            expect(shuffled.totals.subtotalUSD).toBe(original.totals.subtotalUSD);
            expect(shuffled.totals.subtotalBRL).toBe(original.totals.subtotalBRL);

            // Reordenar no crea ni pierde filas, y todo lo que se deriva del neto
            // hereda su invariancia (Requirements 8.1 a 8.4).
            expect(shuffled.rows).toHaveLength(original.rows.length);
            expect(shuffled.totals.utilityCLP).toBe(original.totals.utilityCLP);
            expect(shuffled.totals.rechargeCLP).toBe(original.totals.rechargeCLP);
            expect(shuffled.totals.totalCLP).toBe(original.totals.totalCLP);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
