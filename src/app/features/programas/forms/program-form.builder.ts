import {
  FormArray,
  FormControl,
  FormGroup,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

import { FIELD_LIMITS } from '../constants/field-limits';
import type { CatalogOption, DestinationOption } from '../interfaces/catalog.interface';
import type { ChargeType, CurrencyCode } from '../interfaces/program.interface';
import {
  clpIntegerPriceValidator,
  numericRangeValidator,
} from '../../../shared/validators/numeric-range.validator';
import { documentIdValidator } from '../../../shared/validators/document-id.validator';
import type {
  CrewArray,
  CrewRowGroup,
  CrewRowValue,
  ProgramFormGroup,
  ServiceArray,
  ServiceRowGroup,
  ServiceRowValue,
} from './program-form.types';

/** Clave del error que exige al menos un pasajero pagante. */
export const PAYING_PASSENGER_ERROR_KEY = 'payingPassenger';

/** Generador de identidad estable para filas dinámicas. */
export type RowIdFactory = () => string;

type CrewRowSeed = Partial<Omit<CrewRowValue, 'id'>> & { readonly id?: string };
type ServiceRowSeed = Partial<Omit<ServiceRowValue, 'id'>> & { readonly id?: string };

const defaultRowIdFactory: RowIdFactory = () => globalThis.crypto.randomUUID();

/**
 * Construye el formulario completo del programa.
 *
 * El grupo contiene exclusivamente valores ingresados por el usuario. Pasajeros
 * pagantes, tasas efectivas y montos se derivan fuera del
 * formulario para que nunca queden residuos de un cálculo anterior.
 */
export function buildProgramForm(
  rowIdFactory: RowIdFactory = defaultRowIdFactory,
): ProgramFormGroup {
  return new FormGroup({
    generals: new FormGroup({
      name: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          trimmedRequiredValidator,
          trimmedMinLengthValidator(FIELD_LIMITS.nameMinLength),
        ],
      }),
      description: new FormControl('', { nonNullable: true }),
      plan: new FormControl<CatalogOption | null>(null, Validators.required),
      season: new FormControl<CatalogOption | null>(null, Validators.required),
      destination: new FormControl<DestinationOption | null>(null, Validators.required),
      departureCity: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, trimmedRequiredValidator],
      }),
    }),
    schedule: new FormGroup(
      {
        totalDays: new FormControl<number | null>(null, [
          Validators.required,
          numericRangeValidator(FIELD_LIMITS.totalDays),
        ]),
        totalNights: new FormControl<number | null>(null, [
          Validators.required,
          numericRangeValidator(FIELD_LIMITS.totalNights),
        ]),
        totalPassengers: new FormControl<number | null>(null, [
          Validators.required,
          numericRangeValidator(FIELD_LIMITS.totalPassengers),
        ]),
        freePassengers: new FormControl<number | null>(null, [
          Validators.required,
          numericRangeValidator(FIELD_LIMITS.freePassengers),
        ]),
      },
      { validators: [payingPassengerValidator] },
    ),
    pricing: new FormGroup({
      usdIncreaseCLP: new FormControl<number | null>(null, [
        Validators.required,
        numericRangeValidator(FIELD_LIMITS.usdIncreaseCLP),
      ]),
      brlIncreaseCLP: new FormControl<number | null>(null, [
        Validators.required,
        numericRangeValidator(FIELD_LIMITS.brlIncreaseCLP),
      ]),
      utilityRate: new FormControl<number | null>(null, [
        Validators.required,
        numericRangeValidator(FIELD_LIMITS.utilityRate),
      ]),
      rechargeRate: new FormControl<number | null>(null, [
        Validators.required,
        numericRangeValidator(FIELD_LIMITS.rechargeRate),
      ]),
    }),
    crews: new FormArray<CrewRowGroup>([createCrewRow({}, rowIdFactory)], {
      validators: [Validators.minLength(1), Validators.maxLength(FIELD_LIMITS.maxCrews)],
    }),
    services: new FormArray<ServiceRowGroup>([createServiceRow({}, rowIdFactory)], {
      validators: [Validators.minLength(1), Validators.maxLength(FIELD_LIMITS.maxServices)],
    }),
  });
}

/** Construye una fila de tripulante con identidad estable. */
export function createCrewRow(
  seed: CrewRowSeed = {},
  rowIdFactory: RowIdFactory = defaultRowIdFactory,
): CrewRowGroup {
  return new FormGroup(
    {
      id: new FormControl(seed.id ?? rowIdFactory(), { nonNullable: true }),
      name: new FormControl(seed.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, trimmedRequiredValidator],
      }),
      documentId: new FormControl(seed.documentId ?? '', {
        nonNullable: true,
        validators: [Validators.required, documentIdValidator],
      }),
      dailyPrice: new FormControl<number | null>(seed.dailyPrice ?? null, [
        Validators.required,
        numericRangeValidator(FIELD_LIMITS.itemPrice),
      ]),
      currency: new FormControl<CurrencyCode | null>(seed.currency ?? null, Validators.required),
    },
    { validators: clpIntegerPriceValidator('dailyPrice') },
  );
}

/** Construye una fila de servicio con identidad estable. */
export function createServiceRow(
  seed: ServiceRowSeed = {},
  rowIdFactory: RowIdFactory = defaultRowIdFactory,
): ServiceRowGroup {
  return new FormGroup(
    {
      id: new FormControl(seed.id ?? rowIdFactory(), { nonNullable: true }),
      name: new FormControl(seed.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, trimmedRequiredValidator],
      }),
      chargeType: new FormControl<ChargeType | null>(seed.chargeType ?? null, Validators.required),
      unitPrice: new FormControl<number | null>(seed.unitPrice ?? null, [
        Validators.required,
        numericRangeValidator(FIELD_LIMITS.itemPrice),
      ]),
      currency: new FormControl<CurrencyCode | null>(seed.currency ?? null, Validators.required),
    },
    { validators: clpIntegerPriceValidator('unitPrice') },
  );
}

/** Agrega una fila vacía de tripulante si la lista no alcanzó su máximo. */
export function addCrew(
  crews: CrewArray,
  rowIdFactory: RowIdFactory = defaultRowIdFactory,
): boolean {
  if (crews.length >= FIELD_LIMITS.maxCrews) return false;
  crews.push(createCrewRow({}, rowIdFactory));
  return true;
}

/** Elimina un tripulante sin permitir que la lista quede vacía. */
export function removeCrew(crews: CrewArray, index: number): boolean {
  if (crews.length <= 1 || !isValidIndex(index, crews.length)) return false;
  crews.removeAt(index);
  return true;
}

/** Agrega una fila vacía de servicio si la lista no alcanzó su máximo. */
export function addService(
  services: ServiceArray,
  rowIdFactory: RowIdFactory = defaultRowIdFactory,
): boolean {
  if (services.length >= FIELD_LIMITS.maxServices) return false;
  services.push(createServiceRow({}, rowIdFactory));
  return true;
}

/**
 * Duplica al final los valores editables de un servicio y genera otra
 * identidad de fila, de modo que Angular no reutilice ambos como el mismo ítem.
 */
export function duplicateService(
  services: ServiceArray,
  index: number,
  rowIdFactory: RowIdFactory = defaultRowIdFactory,
): boolean {
  if (services.length >= FIELD_LIMITS.maxServices || !isValidIndex(index, services.length)) {
    return false;
  }

  const { id: _discardedId, ...values } = services.at(index).getRawValue();
  services.push(createServiceRow(values, rowIdFactory));
  return true;
}

/** Elimina un servicio sin permitir que la lista quede vacía. */
export function removeService(services: ServiceArray, index: number): boolean {
  if (services.length <= 1 || !isValidIndex(index, services.length)) return false;
  services.removeAt(index);
  return true;
}

/** Valida el largo mínimo sobre el texto recortado. */
export function trimmedMinLengthValidator(minLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (typeof value !== 'string' || value.trim() === '') return null;

    const actualLength = value.trim().length;
    return actualLength >= minLength
      ? null
      : { minlength: { requiredLength: minLength, actualLength } };
  };
}

/** Trata una cadena de espacios como un campo obligatorio vacío. */
const trimmedRequiredValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: unknown = control.value;
  return typeof value === 'string' && value.trim() === '' ? { required: true } : null;
};

/** Exige que `freePassengers` sea estrictamente menor que el total. */
const payingPassengerValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const total: unknown = group.get('totalPassengers')?.value;
  const free: unknown = group.get('freePassengers')?.value;
  if (typeof total !== 'number' || typeof free !== 'number') return null;

  return free < total ? null : { [PAYING_PASSENGER_ERROR_KEY]: true };
};

function isValidIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}
