/**
 * Normaliza un campo de texto eliminando espacios al inicio/final
 * y colapsando múltiples espacios internos consecutivos en uno solo.
 *
 * Ejemplos:
 *   "  Juan   Carlos   Pérez  " → "Juan Carlos Pérez"
 *   "Vacunación   anual "       → "Vacunación anual"
 *
 * @param value El valor de texto a normalizar
 * @returns El texto normalizado, o una cadena vacía si el valor es nulo/undefined
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}
