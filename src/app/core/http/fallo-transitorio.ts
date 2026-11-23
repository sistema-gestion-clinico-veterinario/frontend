import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export const ESPERAS_DE_REINTENTO_MS = [3000, 6000, 12000];
export const ESPERA_MAXIMA_MS = 20000;
export const MAXIMO_DE_REINTENTOS = 12;
const RETRY_AFTER_MAXIMO_MS = 30000;

export const servidorNoDisponible = (error: unknown): boolean =>
  error instanceof TimeoutError
  || (error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status));

export const esperaDeReintento = (error: unknown, intento: number): number => {
  const retryAfter = error instanceof HttpErrorResponse ? Number(error.headers?.get('Retry-After')) : NaN;
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, RETRY_AFTER_MAXIMO_MS);
  }
  return ESPERAS_DE_REINTENTO_MS[intento - 1] ?? ESPERA_MAXIMA_MS;
};
