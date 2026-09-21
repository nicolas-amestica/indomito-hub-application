/**
 * Tests de ejemplo del validador del rango de fechas (Requirements 3.4 y 3.10).
 *
 * Las fronteras que importan son cuatro: el rango de un solo día, el rango de la
 * duración máxima exacta, el primero que la excede y el invertido por un solo
 * día. Los rangos se escriben con fechas literales calculadas a mano a propósito:
 * derivar la fecha de término con la misma aritmética que usa el validador haría
 * que el test no pudiera detectar un error en esa aritmética.
 *
 * Se incluye un rango que cruza el 29 de febrero porque es donde un conteo de
 * días mal hecho se corre en un día, y ese día decide si el rango excede el
 * máximo o no.
 */

import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS } from '../../features/programas/constants/field-limits';
import {
  DATE_RANGE_MAX_DAYS_ERROR_KEY,
  DATE_RANGE_ORDER_ERROR_KEY,
  dateRangeValidator,
} from './date-range.validator';

/** Grupo del calendario con el rango indicado. */
function buildRange(startDate: unknown, endDate: unknown) {
  return new FormGroup({
    startDate: new FormControl(startDate),
    endDate: new FormControl(endDate),
  });
}

/** Aplica el validador sobre el rango indicado. */
function validate(startDate: unknown, endDate: unknown) {
  return dateRangeValidator(buildRange(startDate, endDate));
}

describe('dateRangeValidator', () => {
  it('acepta un rango de un solo día', () => {
    expect(validate('2025-06-10', '2025-06-10')).toBeNull();
  });

  it('acepta un rango de duración corriente', () => {
    expect(validate('2025-06-10', '2025-06-24')).toBeNull();
  });

  it('acepta el rango de la duración máxima exacta', () => {
    // 100 días contando ambos extremos: enero 31, febrero 28 y marzo 31 suman 90,
    // y el 10 de abril es el día 100. 2025 no es bisiesto.
    expect(FIELD_LIMITS.totalDays.max).toBe(100);
    expect(validate('2025-01-01', '2025-04-10')).toBeNull();
  });

  it('rechaza el primer rango que excede la duración máxima', () => {
    expect(validate('2025-01-01', '2025-04-11')).toEqual({
      [DATE_RANGE_MAX_DAYS_ERROR_KEY]: { max: FIELD_LIMITS.totalDays.max, actual: 101 },
    });
  });

  it('cuenta el 29 de febrero al medir la duración máxima', () => {
    // 2024 es bisiesto: enero 31 más febrero 29 llegan al día 60, marzo cierra en
    // 91 y el 9 de abril es el día 100. Un día menos que el rango de 2025.
    expect(validate('2024-01-01', '2024-04-09')).toBeNull();
    expect(validate('2024-01-01', '2024-04-10')).toEqual({
      [DATE_RANGE_MAX_DAYS_ERROR_KEY]: { max: FIELD_LIMITS.totalDays.max, actual: 101 },
    });
  });

  it('rechaza el rango invertido por un solo día', () => {
    expect(validate('2025-06-10', '2025-06-09')).toEqual({ [DATE_RANGE_ORDER_ERROR_KEY]: true });
  });

  it('rechaza un rango invertido sin reportar la duración', () => {
    // Un rango invertido no tiene duración que exceder: se informa el orden y nada
    // más, para que el panel muestre un solo mensaje.
    expect(validate('2025-12-31', '2025-01-01')).toEqual({ [DATE_RANGE_ORDER_ERROR_KEY]: true });
  });

  it('se abstiene mientras el rango está incompleto', () => {
    expect(validate('2025-06-10', null)).toBeNull();
    expect(validate(null, '2025-06-10')).toBeNull();
    expect(validate(null, null)).toBeNull();
    expect(validate('2025-06-10', '')).toBeNull();
    expect(validate('   ', '2025-06-10')).toBeNull();
  });

  it('se abstiene con una fecha que no es una fecha real', () => {
    expect(validate('2025-06-10', '2025-02-30')).toBeNull();
    expect(validate('2025-06-10', '10-06-2025')).toBeNull();
    expect(validate('ayer', 'hoy')).toBeNull();
  });

  it('se abstiene con una fecha que no es texto', () => {
    expect(validate('2025-06-10', new Date('2025-06-01'))).toBeNull();
  });

  it('se abstiene si el grupo no tiene los controles del rango', () => {
    const group = new FormGroup({ desde: new FormControl('2025-06-10') });

    expect(dateRangeValidator(group)).toBeNull();
  });
});
