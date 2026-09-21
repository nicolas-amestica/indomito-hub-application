/**
 * Generadores de las filas del programa: tripulantes y servicios.
 *
 * El precio se genera **después** de la moneda y en función de ella, porque el
 * Requirement 6.18 solo admite enteros cuando la moneda es CLP. Generar los dos
 * campos de forma independiente produciría filas con 0,01 pesos chilenos, que
 * ningún control del formulario acepta.
 */

import fc from 'fast-check';
import { CHARGE_TYPE_LABELS } from '../../constants/charge-types';
import { FIELD_LIMITS } from '../../constants/field-limits';
import type { ChargeType, CurrencyCode } from '../../interfaces/program.interface';
import type { CrewInput, ServiceInput } from '../calculation.types';
import { arbDocumentId } from './document-id.arbitrary';
import { NAME_TEXT, arbBoundedInt, arbTextOf } from './primitives';

/** Los cinco tipos de cobro, con igual probabilidad cada uno. */
export function arbChargeType(): fc.Arbitrary<ChargeType> {
  return fc.constantFrom(...(Object.keys(CHARGE_TYPE_LABELS) as ChargeType[]));
}

/**
 * Los dos tipos de cobro cuyo monto base multiplica por los días del programa.
 * Con `totalDays` en 0 ambos valen 0, y de ahí sale una de las dos formas de
 * construir un programa de neto 0.
 */
export const DAY_DEPENDENT_CHARGE_TYPES: readonly ChargeType[] = ['per_day', 'per_passenger_day'];

/** Las tres monedas, con igual probabilidad cada una. */
export function arbCurrency(): fc.Arbitrary<CurrencyCode> {
  return fc.constantFrom<CurrencyCode>('CLP', 'USD', 'BRL');
}

/**
 * Precio unitario válido para la moneda indicada. Alcanza el mínimo y el máximo
 * del rango: en CLP el mínimo es 1, porque 0,01 no es entero y el control lo
 * rechaza.
 */
export function arbItemPrice(currency: CurrencyCode): fc.Arbitrary<number> {
  const { min, max } = FIELD_LIMITS.itemPrice;
  if (currency === 'CLP') return arbBoundedInt(1, max);
  const cents = Math.round(max * 100);
  return fc.oneof(
    { arbitrary: fc.constantFrom(min, 0.02, 0.99, 1, max - 0.01, max), weight: 2 },
    {
      arbitrary: fc.integer({ min: 1, max: cents }).map((value) => value / 100),
      weight: 3,
    },
  );
}

/** Nombre visible de una fila. Incluye tildes, ñ y los separadores de un nombre real. */
export function arbItemName(): fc.Arbitrary<string> {
  return arbTextOf(NAME_TEXT, 1, 40);
}

/**
 * Servicio contratado. Alcanza los cinco tipos de cobro con igual probabilidad,
 * las tres monedas y el precio en el mínimo y en el máximo de su rango.
 *
 * @param chargeType Fija el tipo de cobro en vez de sortearlo. Lo usa el caso de
 *   neto 0, que necesita servicios cuyo monto base dependa de los días.
 */
export function arbService(chargeType?: ChargeType): fc.Arbitrary<ServiceInput> {
  return arbCurrency().chain((currency) =>
    fc.record({
      name: arbItemName(),
      chargeType: chargeType === undefined ? arbChargeType() : fc.constant(chargeType),
      unitPrice: arbItemPrice(currency),
      currency: fc.constant(currency),
    }),
  );
}

/**
 * Tripulante. Su monto base no depende del tipo de cobro: siempre es
 * `dailyPrice × totalDays` (Requirement 5.8).
 */
export function arbCrew(): fc.Arbitrary<CrewInput> {
  return arbCurrency().chain((currency) =>
    fc.record({
      name: arbItemName(),
      documentId: arbDocumentId(),
      dailyPrice: arbItemPrice(currency),
      currency: fc.constant(currency),
    }),
  );
}
