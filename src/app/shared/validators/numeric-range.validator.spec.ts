/**
 * Tests de ejemplo de los validadores numéricos (Requirements 3.6, 3.7, 5.10,
 * 5.11, 6.16, 6.17).
 *
 * Se concentran en las fronteras de cada límite de `FIELD_LIMITS` y en los casos
 * que solo existen por la forma del `ValidatorFn`: el control vacío, el valor que
 * no es número y la interacción entre el precio y la moneda de una fila.
 *
 * La tabla se recorre sobre `FIELD_LIMITS` en vez de repetir los números, por lo
 * mismo que el validador los recibe: mover un límite tiene que mover el test.
 *
 * La Propiedad 16 (tarea 8.6) es la que cubre el espacio completo de valores
 * dentro y fuera de rango.
 */

import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS } from '../../features/programas/constants/field-limits';
import {
  CLP_INTEGER_ERROR_KEY,
  clpIntegerPriceValidator,
  NUMERIC_RANGE_ERROR_KEY,
  type NumericLimit,
  numericRangeValidator,
} from './numeric-range.validator';

/** Campos de `FIELD_LIMITS` que declaran un rango cerrado. */
const RANGE_FIELDS: { field: string; limit: NumericLimit }[] = [
  { field: 'totalDays', limit: FIELD_LIMITS.totalDays },
  { field: 'totalNights', limit: FIELD_LIMITS.totalNights },
  { field: 'totalPassengers', limit: FIELD_LIMITS.totalPassengers },
  { field: 'freePassengers', limit: FIELD_LIMITS.freePassengers },
  { field: 'usdIncreaseCLP', limit: FIELD_LIMITS.usdIncreaseCLP },
  { field: 'brlIncreaseCLP', limit: FIELD_LIMITS.brlIncreaseCLP },
  { field: 'utilityRate', limit: FIELD_LIMITS.utilityRate },
  { field: 'rechargeRate', limit: FIELD_LIMITS.rechargeRate },
  { field: 'itemPrice', limit: FIELD_LIMITS.itemPrice },
];

/** Aplica el validador de rango de `limit` sobre un control con `value`. */
function validateRange(limit: NumericLimit, value: unknown) {
  return numericRangeValidator(limit)(new FormControl(value));
}

describe('numericRangeValidator', () => {
  describe.each(RANGE_FIELDS)('$field', ({ limit }) => {
    it('acepta el mínimo y el máximo', () => {
      expect(validateRange(limit, limit.min)).toBeNull();
      expect(validateRange(limit, limit.max)).toBeNull();
    });

    it('rechaza el valor inmediatamente fuera de cada frontera', () => {
      expect(validateRange(limit, limit.min - 1)).not.toBeNull();
      expect(validateRange(limit, limit.max + 1)).not.toBeNull();
    });

    it('se abstiene con el control vacío', () => {
      expect(validateRange(limit, null)).toBeNull();
      expect(validateRange(limit, undefined)).toBeNull();
      expect(validateRange(limit, '')).toBeNull();
    });
  });

  it('reporta el rango y el valor rechazado', () => {
    const { min, max } = FIELD_LIMITS.totalPassengers;

    expect(validateRange(FIELD_LIMITS.totalPassengers, max + 1)).toEqual({
      [NUMERIC_RANGE_ERROR_KEY]: { min, max, actual: max + 1 },
    });
  });

  it('acepta el 0 donde el rango lo incluye y lo rechaza donde no', () => {
    // El 0 no es un valor vacío: es el mínimo de los liberados y de los dos
    // incrementos de divisa, y está bajo el mínimo de un precio.
    expect(validateRange(FIELD_LIMITS.freePassengers, 0)).toBeNull();
    expect(validateRange(FIELD_LIMITS.usdIncreaseCLP, 0)).toBeNull();
    expect(validateRange(FIELD_LIMITS.itemPrice, 0)).not.toBeNull();
  });

  it('acepta el centavo mínimo de un precio y rechaza lo que queda debajo', () => {
    expect(validateRange(FIELD_LIMITS.itemPrice, 0.01)).toBeNull();
    expect(validateRange(FIELD_LIMITS.itemPrice, 0.009)).not.toBeNull();
    expect(validateRange(FIELD_LIMITS.itemPrice, -1)).not.toBeNull();
  });

  it('acepta un decimal de un precio en divisa, que tiene centavos', () => {
    expect(validateRange(FIELD_LIMITS.itemPrice, 40.5)).toBeNull();
  });

  it('acepta un valor dentro del rango que no es múltiplo del paso', () => {
    // El paso lo impone el control, no el validador: la Propiedad 16 exige que la
    // validez equivalga a pertenecer al rango, en los dos sentidos.
    expect(FIELD_LIMITS.usdIncreaseCLP.step).toBe(5);
    expect(validateRange(FIELD_LIMITS.usdIncreaseCLP, 3)).toBeNull();
  });

  it('rechaza NaN, un infinito y un valor que no es número', () => {
    expect(validateRange(FIELD_LIMITS.totalPassengers, Number.NaN)).not.toBeNull();
    expect(validateRange(FIELD_LIMITS.totalPassengers, Number.POSITIVE_INFINITY)).not.toBeNull();
    expect(validateRange(FIELD_LIMITS.totalPassengers, '10')).not.toBeNull();
    expect(validateRange(FIELD_LIMITS.totalPassengers, {})).not.toBeNull();
  });
});

/** Fila de tripulante o de servicio con su precio y su moneda. */
function buildRow(priceControlName: string, price: unknown, currency: unknown) {
  return new FormGroup({
    [priceControlName]: new FormControl(price),
    currency: new FormControl(currency),
  });
}

describe('clpIntegerPriceValidator', () => {
  const validator = clpIntegerPriceValidator('unitPrice');

  it('acepta un precio entero en CLP', () => {
    expect(validator(buildRow('unitPrice', 12_000, 'CLP'))).toBeNull();
  });

  it('rechaza un precio con decimales en CLP', () => {
    expect(validator(buildRow('unitPrice', 12_000.5, 'CLP'))).toEqual({
      [CLP_INTEGER_ERROR_KEY]: { actual: 12_000.5 },
    });
  });

  it('acepta un precio con decimales en una divisa con centavos', () => {
    expect(validator(buildRow('unitPrice', 40.5, 'USD'))).toBeNull();
    expect(validator(buildRow('unitPrice', 40.5, 'BRL'))).toBeNull();
  });

  it('valida el precio diario de un tripulante con el nombre de ese control', () => {
    const crewValidator = clpIntegerPriceValidator('dailyPrice');

    expect(crewValidator(buildRow('dailyPrice', 50_000, 'CLP'))).toBeNull();
    expect(crewValidator(buildRow('dailyPrice', 50_000.25, 'CLP'))).not.toBeNull();
  });

  it('se abstiene mientras la fila está incompleta', () => {
    expect(validator(buildRow('unitPrice', null, 'CLP'))).toBeNull();
    expect(validator(buildRow('unitPrice', '', 'CLP'))).toBeNull();
    expect(validator(buildRow('unitPrice', 12_000.5, null))).toBeNull();
  });

  it('se abstiene con un precio que no es número, que ya reporta el rango', () => {
    expect(validator(buildRow('unitPrice', '12000,5', 'CLP'))).toBeNull();
    expect(validator(buildRow('unitPrice', Number.NaN, 'CLP'))).toBeNull();
  });

  it('se abstiene si el grupo no tiene los controles esperados', () => {
    const group = new FormGroup({ price: new FormControl(12_000.5) });

    expect(validator(group)).toBeNull();
  });
});
