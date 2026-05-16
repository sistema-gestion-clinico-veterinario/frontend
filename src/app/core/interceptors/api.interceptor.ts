import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, finalize, Observable, switchMap, take, throwError } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

export const apiInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const authStore = inject(AuthStore);
  const loadingStore = inject(LoadingStore);
  const authService = inject(AuthService);

  loadingStore.show();

  const token = authStore.token();

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/auth/login')) {
        return handle401Error(authReq, next, authStore, authService);
      }
      return throwError(() => error);
    }),
    finalize(() => loadingStore.hide())
  );
};

const handle401Error = (req: HttpRequest<any>, next: HttpHandlerFn, authStore: any, authService: AuthService): Observable<HttpEvent<any>> => {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = authStore.refreshToken();
    if (refreshToken) {
      return authService.refreshToken(refreshToken).pipe(
        switchMap((res: any) => {
          isRefreshing = false;
          authStore.setAuth({
            ...authStore.$state(),
            token: res.data.token,
            refreshToken: res.data.refreshToken,
            permissions: res.data.permissions,
            roles: res.data.roles
          });
          refreshTokenSubject.next(res.data.token);
          return next(req.clone({
            setHeaders: {
              'Authorization': `Bearer ${res.data.token}`
            }
          }));
        }),
        catchError((err) => {
          isRefreshing = false;
          authStore.logout();
          return throwError(() => err);
        })
      );
    } else {
      isRefreshing = false;
      authStore.logout();
      return throwError(() => new Error('No refresh token available'));
    }
  } else {
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => {
        return next(req.clone({
          setHeaders: {
            'Authorization': `Bearer ${token}`
          }
        }));
      })
    );
  }
};
