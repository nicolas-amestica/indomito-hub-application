/**
 * Generadores de documentos de identidad: RUT chileno, DNI argentino y CPF
 * brasileño (Requirement 5.9).
 *
 * Los documentos se construyen **válidos por construcción**: el dígito
 * verificador se calcula, no se sortea. Generar dígitos al azar y filtrar los que
 * pasen la validación descartaría diez de cada once intentos y, peor, dejaría la
 * validez en manos del código que se está probando.
 *
 * Los algoritmos de dígito verificador viven acá y no se importan del validador
 * (`shared/validators/document-id.validator.ts`, tarea 8.1). Es deliberado: un
 * generador que dependa del código bajo prueba no puede detectar que ese código
 * está mal. Son dos implementaciones independientes del mismo estándar público, y
 * la Propiedad 18 las contrasta.
 */

import fc from 'fast-check';
import { arbBoundedInt, groupThousands } from './primitives';

/** Los tres documentos que el formulario acepta. */
export type DocumentKind = 'rut' | 'dni' | 'cpf';

/** Documento generado, con la metadata que la Propiedad 18 necesita. */
export interface DocumentIdSample {
  kind: DocumentKind;
  /** El documento tal como el usuario lo escribiría, con o sin formato. */
  value: string;
  /** El mismo documento sin puntos. Conserva el guion del RUT y del CPF. */
  raw: string;
  /** Verdadero cuando `value` lleva separadores de miles. */
  formatted: boolean;
}

/** Cuerpo mínimo de un RUT: siete dígitos. */
const RUT_BODY_MIN = 1_000_000;

/** Cuerpo máximo de un RUT: ocho dígitos. */
const RUT_BODY_MAX = 99_999_999;

/** Un DNI argentino tiene siete u ocho dígitos y no lleva dígito verificador. */
const DNI_MIN = 1_000_000;

/** Un DNI argentino tiene siete u ocho dígitos y no lleva dígito verificador. */
const DNI_MAX = 99_999_999;

/**
 * Dígito verificador de un RUT: módulo 11 con factores cíclicos 2 a 7 de derecha
 * a izquierda. El resto 10 se representa con `K` y el 11 con `0`.
 */
export function rutCheckDigit(body: string): string {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  if (rest === 11) return '0';
  if (rest === 10) return 'K';
  return String(rest);
}

/**
 * Un dígito verificador de CPF: módulo 11 con pesos decrecientes desde
 * `startWeight`. El resto 10 se representa con 0.
 */
function cpfCheckDigit(digits: string, startWeight: number): string {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (startWeight - i);
  }
  const rest = (sum * 10) % 11;
  return String(rest === 10 ? 0 : rest);
}

/** Los dos dígitos verificadores de un CPF, a partir de sus nueve dígitos base. */
export function cpfCheckDigits(base: string): string {
  const first = cpfCheckDigit(base, 10);
  const second = cpfCheckDigit(base + first, 11);
  return `${first}${second}`;
}

/** Verdadero si el RUT indicado tiene el dígito verificador que le corresponde. */
export function isValidRut(value: string): boolean {
  const normalized = value.replace(/\./g, '').toUpperCase();
  const match = /^(\d+)-([\dK])$/.exec(normalized);
  if (match === null) return false;
  return rutCheckDigit(match[1]) === match[2];
}

/** Verdadero si el CPF indicado tiene los dos dígitos verificadores que le corresponden. */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/[.-]/g, '');
  if (!/^\d{11}$/.test(digits)) return false;
  // Los once dígitos iguales pasan el módulo 11 pero no son documentos emitidos.
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return cpfCheckDigits(digits.slice(0, 9)) === digits.slice(9);
}

/** RUT chileno válido, con puntos o sin ellos. */
export function arbRut(): fc.Arbitrary<DocumentIdSample> {
  return fc
    .tuple(arbBoundedInt(RUT_BODY_MIN, RUT_BODY_MAX), fc.boolean())
    .map(([body, formatted]) => {
      const digits = String(body);
      const checkDigit = rutCheckDigit(digits);
      const raw = `${digits}-${checkDigit}`;
      return {
        kind: 'rut' as const,
        value: formatted ? `${groupThousands(digits)}-${checkDigit}` : raw,
        raw,
        formatted,
      };
    });
}

/**
 * DNI argentino válido, con puntos o sin ellos. No lleva dígito verificador, así
 * que su validez es solo de forma.
 */
export function arbDni(): fc.Arbitrary<DocumentIdSample> {
  return fc.tuple(arbBoundedInt(DNI_MIN, DNI_MAX), fc.boolean()).map(([number, formatted]) => {
    const digits = String(number);
    return {
      kind: 'dni' as const,
      value: formatted ? groupThousands(digits) : digits,
      raw: digits,
      formatted,
    };
  });
}

/** CPF brasileño válido, con separadores o sin ellos. */
export function arbCpf(): fc.Arbitrary<DocumentIdSample> {
  return fc
    .tuple(fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 }), fc.boolean())
    .map(([baseDigits, formatted]) => {
      const base = baseDigits.join('');
      const check = cpfCheckDigits(base);
      const digits = `${base}${check}`;
      const value = formatted
        ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${check}`
        : digits;
      return { kind: 'cpf' as const, value, raw: digits, formatted };
    })
    .filter((sample) => isValidCpf(sample.raw));
}

/**
 * Documento de identidad válido de cualquiera de los tres países, con y sin
 * formato. Los tres tipos aparecen con igual probabilidad: ninguno es más
 * frecuente que otro en una tripulación real.
 */
export function arbDocumentIdSample(): fc.Arbitrary<DocumentIdSample> {
  return fc.oneof(arbRut(), arbDni(), arbCpf());
}

/** Documento de identidad válido, como lo recibiría un control del formulario. */
export function arbDocumentId(): fc.Arbitrary<string> {
  return arbDocumentIdSample().map((sample) => sample.value);
}

/**
 * Documento válido al que se le alteró un dígito, y que por lo tanto debe ser
 * rechazado. Es la segunda mitad de la Propiedad 18.
 *
 * Excluye el DNI a propósito: no tiene dígito verificador, así que alterarle un
 * dígito produce otro DNI perfectamente válido. Incluirlo generaría contraejemplos
 * falsos contra un validador correcto.
 *
 * El filtro final cubre el único caso donde la mutación no invalida: en el CPF,
 * los restos 0 y 10 comparten representación, así que un cambio en la base puede
 * dejar los dos verificadores intactos.
 */
export function arbMutatedDocumentId(): fc.Arbitrary<string> {
  return fc
    .oneof(
      // Un RUT de cuerpo de siete dígitos queda con ocho dígitos al normalizarlo
      // y, aun con un verificador mutado, puede ser un DNI argentino válido. El
      // cuerpo de ocho evita esa reclasificación: normaliza a nueve caracteres.
      arbRut().filter((sample) => sample.raw.indexOf('-') === 8),
      arbCpf(),
    )
    .chain((sample) =>
      fc
        .tuple(fc.integer({ min: 0, max: sample.raw.length - 1 }), fc.integer({ min: 1, max: 9 }))
        .map(([position, shift]) => ({ sample, mutated: mutateAt(sample.raw, position, shift) })),
    )
    .filter(({ sample, mutated }) => {
      if (mutated === sample.raw) return false;
      return sample.kind === 'rut' ? !isValidRut(mutated) : !isValidCpf(mutated);
    })
    .map(({ mutated }) => mutated);
}

/**
 * Cambia el carácter de `position` por otro distinto. Sobre un dígito rota su
 * valor; sobre el `K` de un RUT o un separador devuelve la cadena intacta, y de
 * eso se ocupa el filtro de quien llama.
 */
function mutateAt(value: string, position: number, shift: number): string {
  const char = value[position];
  if (!/\d/.test(char)) return value;
  const replacement = String((Number(char) + shift) % 10);
  return `${value.slice(0, position)}${replacement}${value.slice(position + 1)}`;
}
