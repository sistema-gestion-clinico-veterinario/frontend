import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, Observable, retry, tap, throwError, timer, TimeoutError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectionStatusService } from '../services/connection-status.service';
import { SKIP_GLOBAL_LOADING } from './http-context.tokens';

export const ESPERAS_DE_REINTENTO_MS = [3000, 6000, 12000];
export const ESPERA_MAXIMA_MS = 20000;
export const MAXIMO_DE_REINTENTOS = 12;
const RETRY_AFTER_MAXIMO_MS = 30000;
const RUTAS_DE_AUTENTICACION = ['/auth/', '/public/'];

const servidorNoDisponible = (error: unknown): boolean =>
  error instanceof TimeoutError
  || (error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status));

const espera = (error: unknown, intento: number): number => {
  const retryAfter = error instanceof HttpErrorResponse ? Number(error.headers?.get('Retry-After')) : NaN;
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, RETRY_AFTER_MAXIMO_MS);
  }
  return ESPERAS_DE_REINTENTO_MS[intento - 1] ?? ESPERA_MAXIMA_MS;
};

export const reconexionInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const estado = inject(ConnectionStatusService);
  if (!req.url.startsWith(environment.apiUrl) || req.context.get(SKIP_GLOBAL_LOADING)) {
    return next(req);
  }

  if (req.method !== 'GET') {
    const esAutenticacion = RUTAS_DE_AUTENTICACION.some(ruta => req.url.includes(ruta));
    return next(req).pipe(
      catchError((error) => {
        if (servidorNoDisponible(error) && !esAutenticacion) {
          estado.escrituraNoGuardada();
        }
        return throwError(() => error);
      })
    );
  }

  let esperando = false;
  let recuperada = false;
  return next(req).pipe(
    retry({
      count: MAXIMO_DE_REINTENTOS,
      delay: (error, intento) => {
        if (!servidorNoDisponible(error)) {
          return throwError(() => error);
        }
        if (!esperando) {
          esperando = true;
          estado.reintentoIniciado();
        }
        return timer(espera(error, intento));
      }
    }),
    tap((evento) => {
      if (esperando && evento instanceof HttpResponse) {
        recuperada = true;
      }
    }),
    finalize(() => {
      if (esperando) {
        estado.reintentoTerminado(recuperada);
      }
    })
  );
};
