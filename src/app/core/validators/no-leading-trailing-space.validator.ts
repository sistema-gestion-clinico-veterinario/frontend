import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function noLeadingTrailingSpaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    return value !== value.trim() ? { leadingTrailingSpace: true } : null;
  };
}
