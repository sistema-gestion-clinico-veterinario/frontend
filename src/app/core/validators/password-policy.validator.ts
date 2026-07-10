import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const PASSWORD_POLICY_MESSAGE =
  'Debe tener minimo 8 caracteres, una mayuscula, una minuscula, un numero y un simbolo como ! o @.';

export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null | undefined;

    if (!value) {
      return null;
    }

    const failedRules: Record<string, boolean> = {};

    if (value.length < 8) failedRules['minLength'] = true;
    if (value.length > 72) failedRules['maxLength'] = true;
    if (/\s/.test(value)) failedRules['noSpaces'] = true;
    if (!/[A-Z]/.test(value)) failedRules['uppercase'] = true;
    if (!/[a-z]/.test(value)) failedRules['lowercase'] = true;
    if (!/\d/.test(value)) failedRules['number'] = true;
    if (!/[^\w\s]/.test(value)) failedRules['special'] = true;

    return Object.keys(failedRules).length ? { passwordPolicy: failedRules } : null;
  };
}

export function strongPasswordValidators(): ValidatorFn[] {
  return [Validators.required, passwordPolicyValidator()];
}
