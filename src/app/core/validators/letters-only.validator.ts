import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function lettersOnlyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    const valid = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s()\-]+$/.test(value);
    return valid ? null : { lettersOnly: true };
  };
}
