/**
 * Validación del rango de fechas del programa: la fecha de término no puede ser
 * anterior a la de inicio (Requirement 3.4) y el rango no puede exceder la
 * duración máxima declarada en `FIELD_LIMITS.totalDays.max` (Requirement 3.10).
 *
 * ## Dos reglas, dos claves de error
 *
 * Un rango invertido y un rango demasiado largo son dos defectos distintos que
 * piden dos mensajes distintos, así que se reportan bajo claves separadas:
 * {@link DATE_RANGE_ORDER_ERROR_KEY} y {@link DATE_RANGE_MAX_DAYS_ERROR_KEY}.
 * Nunca se reportan juntas: un rango invertido no tiene duración que exceder.
 *
 * ## La aritmética de fechas no se reimplementa
 *
 * El conteo de días lo hace `deriveTotalDays` del motor de cálculo, que ya cuenta
 * ambos extremos, opera en UTC y por eso no se equivoca en un cambio de horario
 * de verano ni en un 29 de febrero. Duplicar acá esa aritmética abriría la puerta
 * a que el validador y el motor discrepen en un día, con el efecto de un
 * formulario válido cuyo programa dura 101 días o al revés.
 *
 * De ahí sale el único punto fino: `deriveTotalDays` devuelve 0 tanto para un
 * rango invertido como para uno incompleto o mal formado, y el validador tiene
 * que tratarlos distinto. La distinción se resuelve volviendo a preguntarle al
 * motor con las fechas al revés: si el rango invertido cuenta días, ambas fechas
 * son reales y lo que está mal es el orden. Si tampoco cuenta, alguna fecha no es
 * una fecha, y eso no es asunto de este validador.
 */

import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { deriveTotalDays } from '../../indomito-hub/programs/calculation/calculation-engine';
import { FIELD_LIMITS } from '../../indomito-hub/programs/constants/field-limits';

/** Clave del error de rango invertido: la fecha de término precede a la de inicio. */
export const DATE_RANGE_ORDER_ERROR_KEY = 'dateRangeOrder';

/** Clave del error de duración excedida. */
export const DATE_RANGE_MAX_DAYS_ERROR_KEY = 'dateRangeMaxDays';

/** Nombre del control de la fecha de inicio dentro del grupo del calendario. */
const START_DATE_CONTROL = 'startDate';

/** Nombre del control de la fecha de término dentro del grupo del calendario. */
const END_DATE_CONTROL = 'endDate';

/** Detalle del error de duración excedida. */
export interface DateRangeMaxDaysError {
  /** Duración máxima permitida, tomada de `FIELD_LIMITS.totalDays.max`. */
  readonly max: number;
  /** Días que produce el rango elegido, ambos extremos incluidos. */
  readonly actual: number;
}

/**
 * Valida el rango de fechas del grupo del calendario, que expone los controles
 * `startDate` y `endDate` con fechas ISO 8601 (`YYYY-MM-DD`).
 *
 * Es un validador de grupo porque la regla relaciona dos controles: ninguno de
 * los dos es inválido por sí solo. El grupo queda inválido y el panel del
 * calendario muestra el mensaje que corresponda a la clave reportada.
 *
 * **Se abstiene con el rango incompleto** —una de las dos fechas vacía, que es el
 * estado del formulario recién abierto— y deja ese caso a `Validators.required`
 * de cada control. También se abstiene si alguna fecha no es una fecha real: el
 * orden de un valor que no es fecha no significa nada, y el selector de fechas no
 * produce ese valor.
 *
 * @returns `{ dateRangeOrder: true }` si el término precede al inicio,
 *   `{ dateRangeMaxDays: { max, actual } }` si el rango excede la duración
 *   máxima, o `null` si el rango es válido o no hay nada que juzgar.
 */
export const dateRangeValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const startDate = readIsoDate(group.get(START_DATE_CONTROL));
  const endDate = readIsoDate(group.get(END_DATE_CONTROL));

  if (startDate === null || endDate === null) return null;

  const totalDays = deriveTotalDays(startDate, endDate);

  if (totalDays > 0) {
    const max = FIELD_LIMITS.totalDays.max;
    if (totalDays <= max) return null;

    const error: DateRangeMaxDaysError = { max, actual: totalDays };
    return { [DATE_RANGE_MAX_DAYS_ERROR_KEY]: error };
  }

  // Sin días el rango está invertido o alguna fecha no es real. Contar el rango
  // al revés separa los dos casos: solo dos fechas reales en orden inverso
  // producen días al intercambiarlas.
  const invertedDays = deriveTotalDays(endDate, startDate);
  return invertedDays > 0 ? { [DATE_RANGE_ORDER_ERROR_KEY]: true } : null;
};

/**
 * Lee la fecha de un control como cadena ISO. Devuelve `null` cuando el control
 * no existe, está vacío o no contiene una cadena, que son los casos en que el
 * validador se abstiene.
 */
function readIsoDate(control: AbstractControl | null): string | null {
  if (control === null) return null;

  const value: unknown = control.value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
