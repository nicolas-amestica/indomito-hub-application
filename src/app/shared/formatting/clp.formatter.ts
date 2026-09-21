/**
 * Formateo y lectura de montos en pesos chilenos.
 *
 * El Requirement 9.7 pide que todo monto en CLP se muestre con separador de
 * miles y sin decimales, según la configuración regional de Chile. El locale
 * `es-CL` se registra en `app.config.ts`; acá se usa directamente sobre
 * `Intl.NumberFormat` para que el formateo no dependa de un componente ni de un
 * pipe de Angular, y pueda probarse como función pura.
 *
 * Las dos funciones son inversas entre sí: `parseCLP(formatCLP(n)) === n` para
 * todo entero seguro `n`. Esa reversibilidad es la Propiedad 30 del diseño, y es
 * la razón de que la lectura viva junto al formateo en vez de reimplementarse en
 * cada lugar que necesite volver de la cadena al número.
 *
 * Los símbolos del locale —separador de miles, separador decimal y signo
 * negativo— **no se asumen**: se descubren en tiempo de carga con
 * `formatToParts`. Distintas versiones de ICU eligen caracteres distintos para
 * el mismo locale (un espacio duro en vez de un punto, el signo menos
 * tipográfico U+2212 en vez del guion ASCII). Derivarlos garantiza que la
 * lectura tolere exactamente lo que el formateo produce en el entorno donde
 * corre, y no lo que producía en el entorno donde se escribió este archivo.
 */

/** Configuración regional con la que se formatea todo monto en CLP. */
export const CLP_LOCALE = 'es-CL';

const clpFormatter = new Intl.NumberFormat(CLP_LOCALE, {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Muestra con la que se descubren los símbolos del locale. Es negativa y tiene
 * siete dígitos a propósito: fuerza la aparición del signo negativo y de dos
 * separadores de miles en una sola pasada.
 */
const SYMBOL_PROBE = -1234567;

const probeParts = clpFormatter.formatToParts(SYMBOL_PROBE);

const distinct = (values: readonly string[]): readonly string[] => [...new Set(values)];

const symbolsOfType = (type: Intl.NumberFormatPartTypes): readonly string[] =>
  distinct(probeParts.filter((part) => part.type === type).map((part) => part.value));

/** Separadores de miles que el locale efectivamente emite. */
const GROUP_SEPARATORS = symbolsOfType('group');

/**
 * Signos negativos aceptados al leer. Se incluye el guion ASCII además del
 * símbolo del locale porque es lo que escribe un teclado, y una cadena tipeada
 * a mano también debe poder leerse.
 */
const MINUS_SIGNS = distinct([...symbolsOfType('minusSign'), '-']);

/**
 * Separador decimal del locale. No aparece nunca en la salida de `formatCLP`
 * —el peso chileno no tiene fracción— y su presencia en una cadena de entrada
 * es motivo suficiente para rechazarla.
 */
const DECIMAL_SEPARATOR =
  new Intl.NumberFormat(CLP_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .formatToParts(1.5)
    .find((part) => part.type === 'decimal')?.value ?? ',';

const DIGITS_ONLY = /^\d+$/;

/**
 * Convierte un monto entero en su representación en pesos chilenos.
 *
 * @param amount Monto en CLP. Debe ser un entero seguro.
 * @returns El monto con separador de miles y sin decimales, por ejemplo
 *   `1.234.567`. El cero siempre se devuelve como `0`, sin signo.
 * @throws RangeError Si el monto no es un entero seguro. Un decimal acá es un
 *   error de cálculo, no un caso de presentación: el motor redondea en
 *   `calculation/rounding.ts` y todo lo que llega a la vista ya es entero.
 *   Fallar de forma ruidosa evita mostrar un monto silenciosamente alterado.
 */
export function formatCLP(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`formatCLP espera un entero seguro; recibió ${amount}.`);
  }

  // `amount === 0` es verdadero también para -0, y `Intl` formatearía ese caso
  // como "-0". Normalizarlo mantiene el ida y vuelta exacto.
  return clpFormatter.format(amount === 0 ? 0 : amount);
}

/**
 * Recupera el monto entero a partir de una cadena formateada en CLP.
 *
 * Es la inversa de {@link formatCLP}. A diferencia de ella, no lanza: su entrada
 * puede venir de lo que el usuario escribió, y una cadena inválida es un caso
 * esperado, no un defecto del programa.
 *
 * @param formatted Cadena a leer. Se ignoran los espacios en los extremos.
 * @returns El monto en CLP, o `null` si la cadena no representa un monto entero
 *   válido: vacía, con separador decimal, con caracteres ajenos a los dígitos y
 *   a los símbolos del locale, o fuera del rango de enteros seguros.
 */
export function parseCLP(formatted: string): number | null {
  let text = formatted.trim();

  if (text === '' || text.includes(DECIMAL_SEPARATOR)) {
    return null;
  }

  let isNegative = false;
  for (const sign of MINUS_SIGNS) {
    if (text.startsWith(sign)) {
      isNegative = true;
      text = text.slice(sign.length);
      break;
    }
  }

  for (const separator of GROUP_SEPARATORS) {
    text = text.split(separator).join('');
  }

  if (!DIGITS_ONLY.test(text)) {
    return null;
  }

  const magnitude = Number(text);
  if (!Number.isSafeInteger(magnitude)) {
    return null;
  }

  return isNegative && magnitude !== 0 ? -magnitude : magnitude;
}
