/**
 * Generadores del nombre del programa.
 *
 * El Requirement 2.5 exige un largo mínimo de 3 **sobre el valor recortado**, así
 * que las fronteras interesantes son 2, 3 y 4 caracteres después de recortar, y
 * los rellenos de espacios que hacen que recortar cambie el resultado. Un
 * generador de cadenas cualquiera produce largos de 0 a 60 y casi nunca cae en el
 * borde exacto.
 */

import fc from 'fast-check';
import { FIELD_LIMITS } from '../../constants/field-limits';
import { NAME_LETTERS, NAME_TEXT, WHITESPACE, arbTextOf } from './primitives';

/** Largo máximo de los nombres generados en el tramo general. */
const GENERAL_MAX_LENGTH = 60;

/** Cadenas que un usuario deja al no escribir nada: vacía o solo espacios. */
export function arbBlankProgramName(): fc.Arbitrary<string> {
  return fc.constantFrom('', ' ', '  ', '   ', '\t', '\n', ' \t\n ', '\u00a0');
}

/**
 * Nombre cuyo valor recortado mide exactamente `length` caracteres, envuelto en
 * espacios al azar. El núcleo se arma sin espacios, de modo que recortar devuelva
 * el largo pedido sin ambigüedad.
 */
export function arbProgramNameOfTrimmedLength(length: number): fc.Arbitrary<string> {
  const core = length === 0 ? fc.constant('') : arbTextOf(NAME_LETTERS, length, length);
  return fc
    .tuple(fc.constantFrom(...WHITESPACE), core, fc.constantFrom(...WHITESPACE))
    .map(([before, text, after]) => `${before}${text}${after}`);
}

/**
 * Nombre del programa. Alcanza la cadena vacía, la de solo espacios, tildes, ñ, y
 * los largos recortados de 2, 3 y 4, que son las tres fronteras alrededor del
 * mínimo declarado en `FIELD_LIMITS.nameMinLength`.
 */
export function arbProgramName(): fc.Arbitrary<string> {
  const minLength = FIELD_LIMITS.nameMinLength;
  const boundaryLengths = [minLength - 2, minLength - 1, minLength, minLength + 1].filter(
    (length) => length >= 0,
  );
  return fc.oneof(
    { arbitrary: arbBlankProgramName(), weight: 2 },
    {
      arbitrary: fc
        .constantFrom(...boundaryLengths)
        .chain((length) => arbProgramNameOfTrimmedLength(length)),
      weight: 3,
    },
    { arbitrary: arbAccentedProgramName(), weight: 2 },
    {
      arbitrary: fc
        .tuple(
          fc.constantFrom(...WHITESPACE),
          arbTextOf(NAME_TEXT, 0, GENERAL_MAX_LENGTH),
          fc.constantFrom(...WHITESPACE),
        )
        .map(([before, text, after]) => `${before}${text}${after}`),
      weight: 3,
    },
  );
}

/**
 * Nombre que contiene al menos un carácter acentuado o una ñ. Garantiza el caso
 * que el Requirement 15.8 exige y que un alfabeto mezclado deja al azar.
 */
function arbAccentedProgramName(): fc.Arbitrary<string> {
  const accented = fc.constantFrom(...'áéíóúüñÁÉÍÓÚÜÑ');
  return fc
    .tuple(arbTextOf(NAME_LETTERS, 0, 20), accented, arbTextOf(NAME_LETTERS, 0, 20))
    .map(([before, char, after]) => `${before}${char}${after}`);
}
