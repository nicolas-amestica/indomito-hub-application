import type { AbstractControl, ValidationErrors } from '@angular/forms';

export function trimmedRequiredValidator(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() === ''
    ? { trimmedRequired: true }
    : null;
}
