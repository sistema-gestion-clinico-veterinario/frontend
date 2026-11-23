import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, Observable, retry, tap, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { esperaDeReintento, MAXIMO_DE_REINTENTOS, servidorNoDisponible } from '../http/fallo-transitorio';
import { ConnectionStatusService } from '../services/connection-status.service';
import { SKIP_GLOBAL_LOADING } from './http-context.tokens';

export { ESPERA_MAXIMA_MS, ESPERAS_DE_REINTENTO_MS, MAXIMO_DE_REINTENTOS } from '../http/fallo-transitorio';

const RUTAS_DE_AUTENTICACION = ['/auth/', '/public/'];

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
        return timer(esperaDeReintento(error, intento));
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
