import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function textContentValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    const hasText = /[\p{L}\p{N}]/u.test(value);
    const hasUnsafeCharacter = /[{}\[\]<>*|\\^~`=@]/.test(value);
    return hasText && !hasUnsafeCharacter ? null : { textContent: true };
  };
}
