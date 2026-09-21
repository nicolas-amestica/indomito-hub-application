/**
 * Validación del documento de identidad de un tripulante: RUT chileno, DNI
 * argentino o CPF brasileño, con o sin puntos, guiones y espacios
 * (Requirement 5.9).
 *
 * ## Gemelo en Go
 *
 * `IsValidDocumentID` en `libs/lambdautil/validate.go` del repo `api` implementa
 * exactamente las mismas reglas y es la que el backend registra bajo la etiqueta
 * `documentid`. **Una divergencia entre ambas implementaciones es un defecto**: un
 * documento que este archivo acepta y el backend rechaza deja al usuario con un
 * formulario válido que falla al guardar, y la simétrica deja pasar datos que el
 * frontend prometió filtrar. Cualquier cambio de regla acá exige el cambio espejo
 * allá, y al revés.
 *
 * Las reglas replicadas, en el orden en que se aplican:
 *
 * 1. **Normalización**: se descartan puntos, guiones y espacios; la `k` del dígito
 *    verificador chileno pasa a mayúscula; **cualquier otro carácter invalida el
 *    documento completo** en vez de descartarse.
 * 2. **RUT**: 7 u 8 dígitos de cuerpo más el dígito verificador de módulo 11, que
 *    puede ser un dígito o la letra `K`.
 * 3. **DNI**: 7 u 8 dígitos, sin dígito verificador y sin `0` como primer dígito.
 * 4. **CPF**: 11 dígitos con sus dos dígitos verificadores de módulo 11, y rechazo
 *    de los once dígitos repetidos.
 *
 * Basta que uno de los tres formatos acepte el valor. Como el DNI argentino no
 * tiene dígito verificador, una cadena de 7 u 8 dígitos se acepta por ser un DNI
 * plausible aunque no sea un RUT válido: eso es inherente al formato y no una
 * laxitud de esta implementación. La consecuencia práctica es que solo un RUT de
 * cuerpo de 8 dígitos puede reportarse como inválido por su dígito verificador.
 *
 * ## Fuente de verdad frente a los generadores
 *
 * `features/programas/calculation/__arbitraries__/document-id.arbitrary.ts` expone
 * su propio `isValidRut` e `isValidCpf`. **Esa duplicación es deliberada y no se
 * unifica**: un generador que importara el código bajo prueba no podría detectar
 * que ese código está mal, y la Propiedad 18 existe precisamente para contrastar
 * dos implementaciones independientes del mismo estándar público.
 *
 * La división de responsabilidades es entonces:
 *
 * - **Este archivo es la fuente de verdad de la validación de producción.** Es lo
 *   que decide si un control del formulario es válido, y es lo que debe coincidir
 *   con el backend.
 * - Los helpers del generador son herramientas de test. Solo describen el subconjunto
 *   con formato canónico que el generador construye —el `isValidRut` de allá exige
 *   el guion, este no—, así que no sirven para validar la entrada del usuario y
 *   nunca deben importarse desde la aplicación. El directorio `__arbitraries__`
 *   está excluido de `tsconfig.app.json` justamente para que eso sea imposible.
 */

import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Clave del error que reporta el validador. Se exporta para que la plantilla que
 * muestra el mensaje y los tests referencien el mismo literal.
 */
export const DOCUMENT_ID_ERROR_KEY = 'documentId';

/** Largo mínimo de un RUT normalizado: 7 dígitos de cuerpo más el verificador. */
const RUT_MIN_LENGTH = 8;

/** Largo máximo de un RUT normalizado: 8 dígitos de cuerpo más el verificador. */
const RUT_MAX_LENGTH = 9;

/** Un DNI argentino tiene 7 u 8 dígitos. */
const DNI_MIN_LENGTH = 7;

/** Un DNI argentino tiene 7 u 8 dígitos. */
const DNI_MAX_LENGTH = 8;

/** Un CPF brasileño tiene 11 dígitos, verificadores incluidos. */
const CPF_LENGTH = 11;

/**
 * Valida el documento de identidad de un control del formulario
 * (Requirement 5.9). Reporta `{ documentId: true }` cuando el valor no
 * corresponde a un RUT, un DNI ni un CPF válidos.
 *
 * **Se abstiene con el control vacío** y deja ese caso a `Validators.required`,
 * que el Requirement 5.3 ya exige sobre el mismo campo. Es la única diferencia de
 * forma con el gemelo en Go —`IsValidDocumentID('')` es `false`, como corresponde
 * a una regla de backend que valida un campo ya declarado obligatorio— y no una
 * diferencia de reglas: sin ella, un campo recién agregado mostraría dos mensajes
 * de error a la vez por el mismo motivo.
 *
 * Un valor que no es una cadena sí se reporta como inválido, igual que en Go: la
 * regla aplica a documentos de identidad declarados como texto.
 */
export const documentIdValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: unknown = control.value;

  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return { [DOCUMENT_ID_ERROR_KEY]: true };
  if (value.trim() === '') return null;

  return isValidDocumentId(value) ? null : { [DOCUMENT_ID_ERROR_KEY]: true };
};

/**
 * Indica si `value` corresponde a un RUT chileno, un DNI argentino o un CPF
 * brasileño válido, con o sin puntos, guiones y espacios. Es la función pura que
 * replica a `IsValidDocumentID` de Go; el `ValidatorFn` solo la envuelve.
 */
export function isValidDocumentId(value: string): boolean {
  const normalized = normalizeDocumentId(value);
  if (normalized === '') return false;

  return isValidRut(normalized) || isValidDni(normalized) || isValidCpf(normalized);
}

/**
 * Quita puntos, guiones y espacios, y pasa la `k` del dígito verificador chileno
 * a mayúscula. Devuelve la cadena vacía ante cualquier otro carácter: un
 * documento con basura no se limpia, se rechaza.
 */
function normalizeDocumentId(value: string): string {
  let normalized = '';

  for (const char of value.trim().toUpperCase()) {
    if (isDigit(char) || char === 'K') {
      normalized += char;
    } else if (char !== '.' && char !== '-' && char !== ' ') {
      // Separadores de formato aparte, cualquier otro carácter invalida el
      // documento completo.
      return '';
    }
  }

  return normalized;
}

/**
 * Valida un RUT chileno normalizado: entre 7 y 8 dígitos de cuerpo más el dígito
 * verificador de módulo 11, que puede ser un dígito o la letra `K`.
 */
function isValidRut(normalized: string): boolean {
  if (normalized.length < RUT_MIN_LENGTH || normalized.length > RUT_MAX_LENGTH) return false;

  const body = normalized.slice(0, -1);
  const checkDigit = normalized.slice(-1);

  if (!isAllDigits(body)) return false;

  return checkDigit === rutCheckDigit(body);
}

/**
 * Calcula el dígito verificador de módulo 11 del cuerpo de un RUT, con la serie
 * de multiplicadores 2 a 7 recorrida de derecha a izquierda.
 */
function rutCheckDigit(body: string): string {
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index--) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Valida un DNI argentino normalizado: 7 u 8 dígitos, sin dígito verificador. Se
 * descarta el `0` como primer dígito porque no existe un DNI que empiece en cero.
 */
function isValidDni(normalized: string): boolean {
  if (normalized.length < DNI_MIN_LENGTH || normalized.length > DNI_MAX_LENGTH) return false;
  if (normalized[0] === '0') return false;
  return isAllDigits(normalized);
}

/**
 * Valida un CPF brasileño normalizado: 11 dígitos y sus dos dígitos verificadores
 * de módulo 11. Los once dígitos repetidos se rechazan: pasan la aritmética pero
 * ninguno es un CPF emitido.
 */
function isValidCpf(normalized: string): boolean {
  if (normalized.length !== CPF_LENGTH || !isAllDigits(normalized)) return false;
  if (normalized.split('').every((char) => char === normalized[0])) return false;

  if (normalized[9] !== cpfCheckDigit(normalized.slice(0, 9), 10)) return false;

  return normalized[10] === cpfCheckDigit(normalized.slice(0, 10), 11);
}

/**
 * Calcula un dígito verificador de CPF sobre `digits`, con la serie de
 * multiplicadores que arranca en `weight` y decrece. El resto 10 se representa
 * con `0`.
 */
function cpfCheckDigit(digits: string, weight: number): string {
  let sum = 0;

  for (let index = 0; index < digits.length; index++) {
    sum += Number(digits[index]) * (weight - index);
  }

  const remainder = (sum * 10) % 11;
  return remainder === 10 ? '0' : String(remainder);
}

/** Verdadero si `char` es un dígito decimal. */
function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

/** Verdadero si `value` está compuesto solo por dígitos y no está vacío. */
function isAllDigits(value: string): boolean {
  if (value === '') return false;

  for (const char of value) {
    if (!isDigit(char)) return false;
  }

  return true;
}
