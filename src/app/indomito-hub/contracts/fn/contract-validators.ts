import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function isValidChileanRut(value: string): boolean {
  const cleaned = value.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  const match = cleaned.match(/^(\d{7,8})-([0-9K])$/);
  if (!match) return false;
  let sum = 0;
  let factor = 2;
  for (let index = match[1].length - 1; index >= 0; index--) {
    sum += Number(match[1][index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const result = 11 - (sum % 11);
  return (result === 11 ? '0' : result === 10 ? 'K' : String(result)) === match[2];
}

export const rutValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  return value === '' || isValidChileanRut(value) ? null : { rut: true };
};

export const birthDateValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const raw = String(control.value ?? '').trim();
  if (raw === '') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const local = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(raw);
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local
      ? [Number(local[3]), Number(local[2]), Number(local[1])]
      : [0, 0, 0];
  const date = new Date(year, month - 1, day);
  const valid =
    year >= 1920 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date <= new Date();
  return valid ? null : { birthDate: true };
};
