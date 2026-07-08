import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface TextContentOptions {
  requireLetter?: boolean;
}

export function textContentValidator(options: TextContentOptions = {}): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed !== value) return { textContent: true };

    const requireLetter = options.requireLetter ?? true;
    const hasLetter = /\p{L}/u.test(trimmed);
    const hasText = requireLetter ? hasLetter : /[\p{L}\p{N}]/u.test(trimmed);
    const onlySymbols = /^[\p{P}\p{S}\s]+$/u.test(trimmed);
    const onlyNumbers = /^\d+$/.test(trimmed);
    const hasUnsafeCharacter = /[{}\[\]<>*|\\^~`=@]/.test(trimmed);
    const hasXssSignal = /<\s*\/?\s*(script|iframe|object|embed|style|img|svg|body|html|link|meta)\b|javascript:|data:text\/html|on\w+\s*=/i.test(trimmed);
    const punctuationCount = (trimmed.match(/[\p{P}\p{S}]/gu) ?? []).length;
    const excessivePunctuation = /[\p{P}\p{S}]{6,}/u.test(trimmed)
      || (punctuationCount >= 8 && punctuationCount / trimmed.length > 0.45);

    return hasText && !onlySymbols && !(requireLetter && onlyNumbers) && !hasUnsafeCharacter && !hasXssSignal && !excessivePunctuation
      ? null
      : { textContent: true };
  };
}
