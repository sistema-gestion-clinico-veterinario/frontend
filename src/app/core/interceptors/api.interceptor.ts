import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, finalize, Observable, switchMap, take, throwError, timeout } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const UPLOAD_REQUEST_TIMEOUT_MS = 120000;
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/setup-account',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/validate-reset-token',
  '/auth/reset-password'
];

const shouldSkipRefresh = (url: string): boolean =>
  AUTH_ENDPOINTS_WITHOUT_REFRESH.some(endpoint => url.includes(endpoint));

export const apiInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const authStore = inject(AuthStore);
  const loadingStore = inject(LoadingStore);
  const authService = inject(AuthService);
  const router = inject(Router);
  const skipGlobalLoading = req.context.get(SKIP_GLOBAL_LOADING);

  if (!skipGlobalLoading) {
    loadingStore.show();
  }

  const authReq = req.clone({
    withCredentials: true
  });

  const requestTimeout = req.url.includes('/media/upload')
    ? UPLOAD_REQUEST_TIMEOUT_MS
    : DEFAULT_REQUEST_TIMEOUT_MS;

  return next(authReq).pipe(
    timeout(requestTimeout),
    catchError((error) => {
      const isAuthRecoveryRequest = shouldSkipRefresh(req.url);
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthRecoveryRequest) {
        return handle401Error(authReq, next, authStore, authService, router);
      }
      return throwError(() => error);
    }),
    finalize(() => {
      if (!skipGlobalLoading) {
        loadingStore.hide();
      }
    })
  );
};

const handle401Error = (req: HttpRequest<any>, next: HttpHandlerFn, authStore: any, authService: AuthService, router: Router): Observable<HttpEvent<any>> => {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(false);

    // Call refresh without body — browser sends refresh_token cookie automatically
    return authService.refreshToken().pipe(
      switchMap((res: any) => {
        isRefreshing = false;
        authStore.setAuth({
          token: null,
          refreshToken: null,
          roles: res.data.roles,
          companyId: res.data.companyId,
          companyName: res.data.companyName,
          nombreCompleto: res.data.nombreCompleto,
          userType: res.data.userType,
          empleadoId: res.data.empleadoId ?? null,
          passwordChanged: res.data.passwordChanged,
          needsCompanySelection: res.data.needsCompanySelection,
          selectedEnterprise: authStore.selectedEnterprise(),
          menu: res.data.menu,
          simulatedRoleId: authStore.simulatedRoleId(),
          originalMenu: res.data.menu,
          originalRoles: res.data.assignedRoles ?? res.data.roles,
          assignedRoles: res.data.assignedRoles ?? authStore.assignedRoles()
          ,availableRoles: res.data.availableRoles ?? authStore.availableRoles()
          ,activeRoleId: res.data.activeRoleId ?? authStore.activeRoleId()
          ,activeRoleName: res.data.activeRoleName ?? authStore.activeRoleName()
          ,activeRoleScope: res.data.activeRoleScope ?? authStore.activeRoleScope()
          ,activeRolePurpose: res.data.activeRolePurpose ?? authStore.activeRolePurpose()
          ,permissionVersion: res.data.permissionVersion ?? authStore.permissionVersion()
        });
        refreshTokenSubject.next(true);
        return next(req.clone({ withCredentials: true }));
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshTokenSubject.next(false);
        refreshTokenSubject = new BehaviorSubject<boolean>(false);
        authStore.logout();
        router.navigate(['/login']);
        return throwError(() => err);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter(ok => ok),
      take(1),
      switchMap(() => {
        return next(req.clone({ withCredentials: true }));
      })
    );
  }
};
