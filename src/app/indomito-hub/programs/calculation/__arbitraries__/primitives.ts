/**
 * Piezas base de los generadores de `fast-check`.
 *
 * El criterio de todo este directorio está acá: un generador uniforme sobre un
 * rango grande casi nunca produce sus fronteras, y las fronteras son donde viven
 * los defectos. `arbBoundedInt` reserva parte de su probabilidad a los extremos
 * y a sus vecinos en vez de confiar en el azar.
 *
 * Ver la sección "Generadores" de `design.md`.
 */

import fc from 'fast-check';

/** Límite numérico con paso, tal como lo declara `FIELD_LIMITS`. */
export interface SteppedLimit {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** Límite numérico sin paso declarado. */
export interface RangeLimit {
  readonly min: number;
  readonly max: number;
}

/**
 * Entero en `[min, max]` con las dos fronteras y sus vecinos garantizados.
 *
 * Reparte la probabilidad entre un conjunto pequeño de valores de frontera y el
 * rango completo. Sin esta mezcla, una propiedad que solo falla en `max` puede
 * pasar cien iteraciones sin enterarse.
 */
export function arbBoundedInt(min: number, max: number): fc.Arbitrary<number> {
  if (min >= max) return fc.constant(min);
  const edges = [...new Set([min, min + 1, max - 1, max])].filter(
    (value) => value >= min && value <= max,
  );
  return fc.oneof(
    { arbitrary: fc.constantFrom(...edges), weight: 2 },
    { arbitrary: fc.integer({ min, max }), weight: 3 },
  );
}

/**
 * Múltiplo de `step` dentro de `[min, max]`, con las dos fronteras garantizadas.
 * Los incrementos de divisa se eligen en un control con paso, así que un valor
 * intermedio no es alcanzable en la interfaz y no vale la pena generarlo.
 */
export function arbSteppedInt(limit: SteppedLimit): fc.Arbitrary<number> {
  const steps = Math.floor((limit.max - limit.min) / limit.step);
  return arbBoundedInt(0, steps).map((k) => limit.min + k * limit.step);
}

/** Entero dentro de un límite de `FIELD_LIMITS`, ignorando el paso. */
export function arbLimitInt(limit: RangeLimit): fc.Arbitrary<number> {
  return arbBoundedInt(limit.min, limit.max);
}

/**
 * Tamaño de lista con las fronteras garantizadas: la lista vacía, la de una
 * sola fila y la del máximo declarado. Los tres son casos donde el cálculo se
 * comporta distinto: sin filas el neto es 0, con una sola no hay agregación, y
 * en el máximo se acumula el error de redondeo de todas las conversiones.
 */
export function arbListSize(maxSize: number): fc.Arbitrary<number> {
  return fc.oneof(
    { arbitrary: fc.constantFrom(0, 1, 2, maxSize), weight: 3 },
    { arbitrary: fc.integer({ min: 0, max: maxSize }), weight: 2 },
  );
}

/** Letras, tildes, ñ y dígitos. Sin espacios: sirve para largos exactos. */
export const NAME_LETTERS: readonly string[] = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'áéíóúüñÁÉÍÓÚÜÑ',
  ...'0123456789',
];

/** Alfabeto de texto visible: letras más los separadores que un nombre real usa. */
export const NAME_TEXT: readonly string[] = [...NAME_LETTERS, ' ', '-', '.', ',', '(', ')', '/'];

/** Espacios en blanco que un usuario deja por descuido antes o después de escribir. */
export const WHITESPACE: readonly string[] = ['', ' ', '  ', '\t', '\n', ' \t '];

/** Cadena de largo `[minLength, maxLength]` armada con el alfabeto indicado. */
export function arbTextOf(
  alphabet: readonly string[],
  minLength: number,
  maxLength: number,
): fc.Arbitrary<string> {
  if (maxLength === 0) return fc.constant('');
  return fc
    .array(fc.constantFrom(...alphabet), { minLength, maxLength })
    .map((chars) => chars.join(''));
}

/** Fecha ISO 8601 sin hora (`YYYY-MM-DD`). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Desplaza una fecha ISO en días. Opera en UTC para no depender de la zona local. */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** Verdadero si `target` cae dentro del rango cerrado. Comparación lexicográfica de ISO 8601. */
export function isoRangeContains(startDate: string, endDate: string, target: string): boolean {
  return startDate <= target && target <= endDate;
}

/** Agrupa dígitos en miles con punto: `12345678` a `12.345.678`. */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
