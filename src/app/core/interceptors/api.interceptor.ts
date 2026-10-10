import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, finalize, Observable, switchMap, take, throwError, timeout } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';
import { AuthService } from '../services/auth.service';
import { CompanySlugContext } from '../services/company-slug-context.service';
import { environment } from '../../../environments/environment';
import { companySlugFromUrl } from '../routing/slug-url.utils';
import { SKIP_GLOBAL_LOADING } from './http-context.tokens';

// Se conserva la exportación para los servicios existentes; las dependencias
// nuevas deben importar el token desde http-context.tokens.
export { SKIP_GLOBAL_LOADING } from './http-context.tokens';

let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const UPLOAD_REQUEST_TIMEOUT_MS = 120000;
const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/admin-login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/setup-account',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/validate-reset-token',
  '/auth/reset-password',
  '/auth/email-change/confirm-current',
  '/auth/email-change/cancel',
  '/auth/email-change/confirm-new'
];

const shouldSkipRefresh = (url: string): boolean =>
  AUTH_ENDPOINTS_WITHOUT_REFRESH.some(endpoint => url.includes(endpoint));

export const apiInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const authStore = inject(AuthStore);
  const loadingStore = inject(LoadingStore);
  const authService = inject(AuthService);
  const slugContext = inject(CompanySlugContext);
  const router = inject(Router);
  const skipGlobalLoading = req.context.get(SKIP_GLOBAL_LOADING);

  if (!skipGlobalLoading) {
    loadingStore.show();
  }

  // La sesión de una clínica trae su empresa desde el backend. En una sesión
  // global, la empresa seleccionada en la barra superior define el contexto
  // operativo de esta petición; el backend vuelve a validarlo.
  const companyId = authStore.companyId() ?? authStore.selectedEnterprise()?.establishmentId ?? null;
  const declaresCompany = companyId != null && req.url.startsWith(environment.apiUrl) && !shouldSkipRefresh(req.url);
  // La URL visible es la fuente de verdad del tenant de esta pestaña. Si el
  // estado en memoria perteneciera a otra clínica, enviar su slug ocultaría el
  // conflicto al backend y permitiría cargar datos bajo una URL equivocada.
  const urlSlug = typeof window === 'undefined'
    ? slugContext.slug()
    : companySlugFromUrl(window.location.pathname);
  const slug = urlSlug ?? slugContext.slug() ?? authStore.companySlug();
  const declaresSlug = !!slug && req.url.startsWith(environment.apiUrl);
  const headers = {
    ...(declaresCompany ? { 'X-Company-Id': String(companyId) } : {}),
    ...(declaresSlug ? { 'X-Company-Slug': slug as string } : {})
  };
  const authReq = req.clone({
    withCredentials: true,
    ...(Object.keys(headers).length ? { setHeaders: headers } : {})
  });

  const requestTimeout = req.url.includes('/media/upload') || req.url.includes('/ia/diagnostico')
    ? UPLOAD_REQUEST_TIMEOUT_MS
    : DEFAULT_REQUEST_TIMEOUT_MS;

  return next(authReq).pipe(
    timeout(requestTimeout),
    catchError((error) => {
      const isAuthRecoveryRequest = shouldSkipRefresh(req.url);
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthRecoveryRequest) {
        return handle401Error(authReq, next, authStore, authService, router);
      }
      if (error instanceof HttpErrorResponse && error.status === 409
          && error.error?.code === 'SESSION_COMPANY_MISMATCH') {
        endForOtherCompanySession(authStore, router);
        return throwError(() => error);
      }
      if (error instanceof HttpErrorResponse && error.status === 428
          && error.error?.code === 'PRIVACY_NOTICE_REQUIRED'
          && !router.url.includes('/aviso-clinica')) {
        router.navigateByUrl('/aviso-clinica');
      }
      if (error instanceof HttpErrorResponse && error.status === 403
          && error.error?.code === 'TERMS_NOT_ACCEPTED'
          && !router.url.startsWith('/legal')) {
        router.navigateByUrl('/legal/accept');
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

const endForOtherCompanySession = (authStore: any, router: Router): void => {
  authStore.logout();
  router.navigateByUrl('/login?authNotice=sesion_otra_clinica', { replaceUrl: true });
};

const handle401Error = (req: HttpRequest<any>, next: HttpHandlerFn, authStore: any, authService: AuthService, router: Router): Observable<HttpEvent<any>> => {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(false);

    // Call refresh without body — browser sends refresh_token cookie automatically
    return authService.refreshToken().pipe(
      switchMap((res: any) => {
        isRefreshing = false;
        const currentCompany = authStore.companyId();
        if (currentCompany != null && res.data.companyId != null && currentCompany !== res.data.companyId) {
          refreshTokenSubject.next(false);
          refreshTokenSubject = new BehaviorSubject<boolean>(false);
          endForOtherCompanySession(authStore, router);
          return throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'SESSION_COMPANY_MISMATCH' } }));
        }
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
          needsLegalAcceptance: res.data.needsLegalAcceptance,
          legalAcceptanceOverdue: res.data.legalAcceptanceOverdue,
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
        // El SlugUrlSerializer conoce el slug actual y lo antepone solo en
        // la barra de direcciones.
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
