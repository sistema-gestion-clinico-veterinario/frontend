export function hasMeaningfulText(value: string | null | undefined, requireLetter = true): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value) return false;
  if (/^[\p{P}\p{S}\s]+$/u.test(trimmed)) return false;
  if (/[{}\[\]<>*|\\^~`=@]/.test(trimmed)) return false;
  if (/<\s*\/?\s*(script|iframe|object|embed|style|img|svg|body|html|link|meta)\b|javascript:|data:text\/html|on\w+\s*=/i.test(trimmed)) return false;
  return requireLetter ? /\p{L}/u.test(trimmed) && !/^\d+$/.test(trimmed) : /[\p{L}\p{N}]/u.test(trimmed);
}

export function isLowercaseEmail(value: string | null | undefined, maxLength = 100): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0
    && trimmed.length <= maxLength
    && trimmed === value
    && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed);
}

function toDateKey(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return value.substring(0, 10);
}

export function isDateRangeValid(start: string | Date | null | undefined, end: string | Date | null | undefined): boolean {
  if (!start || !end) return true;
  return toDateKey(end) >= toDateKey(start);
}

export function isFutureOrToday(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  const today = new Date().toISOString().split('T')[0];
  return toDateKey(date) >= today;
}

export function toDateInputKey(value: string | Date | null | undefined): string {
  return toDateKey(value);
}
