import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function lowercaseEmailValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    const valid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value);
    return valid ? null : { lowercaseEmail: true };
  };
}
