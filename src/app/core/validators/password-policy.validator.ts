import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const PASSWORD_POLICY_MESSAGE =
  'Usa al menos 12 caracteres con mayúsculas, minúsculas, números y un símbolo; evita datos personales, secuencias o contraseñas comunes.';

export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null | undefined;

    if (!value) {
      return null;
    }

    const failedRules: Record<string, boolean> = {};

    if ([...value].length < 12) failedRules['minLength'] = true;
    if (value.length > 72) failedRules['maxLength'] = true;
    if (new TextEncoder().encode(value).length > 72) failedRules['maxBytes'] = true;
    if (/(012345|123456|234567|345678|456789|abcdef|qwerty)/i.test(value)) {
      failedRules['predictable'] = true;
    }
    if (!/[A-ZÁÉÍÓÚÑÜ]/.test(value)) failedRules['upper'] = true;
    if (!/[a-záéíóúñü]/.test(value)) failedRules['lower'] = true;
    if (!/[0-9]/.test(value)) failedRules['digit'] = true;
    if (!/[^A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]/.test(value)) failedRules['symbol'] = true;

    return Object.keys(failedRules).length ? { passwordPolicy: failedRules } : null;
  };
}

export function strongPasswordValidators(): ValidatorFn[] {
  return [Validators.required, passwordPolicyValidator()];
}
