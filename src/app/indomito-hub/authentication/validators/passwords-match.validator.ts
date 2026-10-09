import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const passwordsMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.get('password')?.value as unknown;
  const confirmation = control.get('confirmation')?.value as unknown;
  return password === confirmation ? null : { passwordsMismatch: true };
};
