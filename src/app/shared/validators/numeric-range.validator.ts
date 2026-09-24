/**
 * Validación numérica de los campos del programa: pertenencia al rango declarado
 * y entero obligatorio cuando la moneda del ítem es CLP (Requirements 3.6, 3.7,
 * 5.10, 5.11, 6.16, 6.17).
 *
 * ## Los rangos no se escriben acá
 *
 * `numericRangeValidator` recibe el rango en vez de conocerlo. La única fuente de
 * los rangos es `FIELD_LIMITS` en `indomito-hub/programs/constants/field-limits.ts`,
 * y el llamador pasa la entrada que corresponde:
 *
 * ```ts
 * totalNights: [null, [Validators.required, numericRangeValidator(FIELD_LIMITS.totalNights)]],
 * dailyPrice:  [null, [Validators.required, numericRangeValidator(FIELD_LIMITS.itemPrice)]],
 * ```
 *
 * Eso es lo que hace que mover un límite en `FIELD_LIMITS` mueva la validación
 * sin tocar este archivo. **Copiar un mínimo o un máximo acá sería un defecto**:
 * dejaría dos fuentes de verdad para el mismo rango, y la que el formulario
 * aplica no sería la que la tabla de límites documenta. Por lo mismo este archivo
 * no importa `FIELD_LIMITS`: es un validador genérico de rango, no el registro de
 * los rangos del programa.
 *
 * ## El validador de rango valida el rango, y nada más
 *
 * No comprueba el `step` de `FIELD_LIMITS` ni exige enteros. Las dos omisiones
 * son deliberadas:
 *
 * - El `step` es cosa del control. Los Requirements 4.2 y 4.3 piden *presentar*
 *   los incrementos de divisa en múltiplos de 5, así que el control solo ofrece
 *   múltiplos y no hay nada que rechazar. Validarlo además convertiría un valor
 *   dentro del rango en un valor inválido, y la Propiedad 16 exige que la validez
 *   equivalga a pertenecer al rango **en los dos sentidos**.
 * - El entero de los precios depende de la moneda del ítem y no del rango, así
 *   que vive en {@link clpIntegerPriceValidator}, sobre el grupo de la fila.
 *
 * Sigue el patrón de `document-id.validator.ts`: clave de error exportada como
 * constante y abstención con el control vacío, que es caso de
 * `Validators.required`.
 */

import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Clave del error de rango. Se exporta para que la plantilla que muestra el
 * mensaje y los tests referencien el mismo literal.
 */
export const NUMERIC_RANGE_ERROR_KEY = 'numericRange';

/**
 * Clave del error de precio no entero en CLP. Se reporta sobre el grupo de la
 * fila, no sobre el control del precio; ver {@link clpIntegerPriceValidator}.
 */
export const CLP_INTEGER_ERROR_KEY = 'clpIntegerPrice';

/**
 * Moneda cuyos precios deben ser enteros. Coincide con el valor `'CLP'` de
 * `CurrencyCode`; se declara acá como literal para que `shared/` no dependa del
 * contrato de una feature.
 */
const CLP_CURRENCY = 'CLP';

/** Nombre por defecto del control de moneda dentro del grupo de una fila. */
const DEFAULT_CURRENCY_CONTROL = 'currency';

/**
 * Rango cerrado de un campo numérico. Toda entrada de `FIELD_LIMITS` con `min` y
 * `max` lo satisface, con o sin `step`.
 */
export interface NumericLimit {
  readonly min: number;
  readonly max: number;
}

/** Detalle del error de rango. Lleva el rango para que el mensaje se arme desde él. */
export interface NumericRangeError {
  readonly min: number;
  readonly max: number;
  /** Valor rechazado, tal como venía en el control. */
  readonly actual: unknown;
}

/** Detalle del error de precio no entero en CLP. */
export interface ClpIntegerError {
  /** Precio rechazado. */
  readonly actual: number;
}

/**
 * Construye el validador de rango de un campo numérico a partir de su límite
 * declarado en `FIELD_LIMITS`.
 *
 * Reporta `{ numericRange: { min, max, actual } }` cuando el valor queda fuera
 * del rango cerrado `[min, max]`, y también cuando no es un número: un campo
 * numérico con un valor que no es número no está en su rango. `NaN` se rechaza
 * por la misma vía, porque no compara dentro de ningún intervalo.
 *
 * **Se abstiene con el control vacío** —`null`, `undefined` o cadena vacía— y
 * deja ese caso a `Validators.required`, que acompaña a todos estos campos. Sin
 * la abstención, un campo recién agregado mostraría dos mensajes a la vez por el
 * mismo motivo.
 *
 * @param limit Entrada de `FIELD_LIMITS` con el rango del campo.
 * @returns El `ValidatorFn` de ese campo.
 */
export function numericRangeValidator(limit: NumericLimit): ValidatorFn {
  const { min, max } = limit;

  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;

    if (isEmptyValue(value)) return null;

    if (typeof value !== 'number' || !(value >= min && value <= max)) {
      const error: NumericRangeError = { min, max, actual: value };
      return { [NUMERIC_RANGE_ERROR_KEY]: error };
    }

    return null;
  };
}

/**
 * Construye el validador que exige un precio entero cuando la moneda de la fila
 * es CLP (Requirements 5.11 y 6.17).
 *
 * **Es un validador de grupo y no de control** porque la regla no depende del
 * precio solo, sino del precio y de la moneda de la misma fila. Un validador
 * sobre el control del precio no vería la moneda, y hacerlo depender de ella con
 * `updateValueAndValidity` desde una suscripción a la moneda reintroduce el
 * patrón de recálculo cruzado que el diseño evita en el formulario. Acá el grupo
 * de la fila queda inválido y el panel muestra el mensaje bajo el precio.
 *
 * Reporta `{ clpIntegerPrice: { actual } }`. Se abstiene cuando la moneda no es
 * CLP, cuando falta alguno de los dos controles, cuando el precio está vacío
 * —caso de `Validators.required`— y cuando el precio no es un número finito, que
 * es lo que ya reporta {@link numericRangeValidator} sobre el mismo valor.
 *
 * @param priceControlName Nombre del control del precio: `dailyPrice` en una fila
 *   de tripulante, `unitPrice` en una de servicio.
 * @param currencyControlName Nombre del control de moneda. Por defecto `currency`.
 * @returns El `ValidatorFn` del grupo de la fila.
 */
export function clpIntegerPriceValidator(
  priceControlName: string,
  currencyControlName: string = DEFAULT_CURRENCY_CONTROL,
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const priceControl = group.get(priceControlName);
    const currencyControl = group.get(currencyControlName);

    if (priceControl === null || currencyControl === null) return null;
    if (currencyControl.value !== CLP_CURRENCY) return null;

    const value: unknown = priceControl.value;

    if (isEmptyValue(value)) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (Number.isInteger(value)) return null;

    const error: ClpIntegerError = { actual: value };
    return { [CLP_INTEGER_ERROR_KEY]: error };
  };
}

/**
 * Verdadero para los valores con los que un control numérico está vacío. La
 * cadena vacía se incluye porque es lo que deja un campo de texto al borrarse, y
 * el `0` queda fuera a propósito: es un valor legítimo de varios de estos campos.
 */
function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}
