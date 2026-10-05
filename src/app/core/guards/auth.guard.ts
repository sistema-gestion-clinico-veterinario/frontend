import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { resolveDashboardRoute, resolveInitialRoute } from '../../layouts/main-layout/navbar/navbar.component';
import { map } from 'rxjs';
import { SessionService } from '../services/session.service';
import { CompanySlugContext } from '../services/company-slug-context.service';
import { companySlugFromUrl } from '../routing/slug-url.utils';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const sessionService = inject(SessionService);
  const slugContext = inject(CompanySlugContext);

  // Leer la barra de direcciones directamente evita que un estado de sesión
  // previo reemplace el slug y haga pasar por válida otra clínica.
  const urlSlug = typeof window === 'undefined'
    ? slugContext.slug()
    : companySlugFromUrl(window.location.pathname) ?? slugContext.slug();
  return sessionService.initialize(urlSlug).pipe(
    map((authenticated) => {
      if (authenticated) return validateAccess(route, authStore, router);
      if (sessionService.sessionConflict()) {
        sessionService.sessionConflict.set(false);
        return router.createUrlTree(['/login'], { queryParams: { authNotice: 'sesion_otra_clinica' } });
      }
      return router.createUrlTree(['/login']);
    })
  );
};

function validateAccess(route: ActivatedRouteSnapshot, authStore: any, router: Router) {
  const currentMenu = authStore.menu() ?? [];
  if (!authStore.activeRoleId() && currentMenu.length === 0) {
    // El SlugUrlSerializer ya conoce el slug de la sesion actual y lo vuelve
    // a anteponer solo en la barra de direcciones - no hace falta construirlo
    // a mano (y hacerlo rompe el enrutado: el slug dejo de ser un segmento
    // real que Angular Router conozca).
    authStore.logout();
    return router.createUrlTree(['/login']);
  }

  if (route.data?.['thesisTool']) {
    return true;
  }

  // Dynamic route pattern access check
  const pattern = getRoutePattern(route);
  if (pattern && !isPurposeDashboardRoute(pattern, authStore.activeRolePurpose()) && !authStore.hasRouteAccess(pattern)) {
    return router.createUrlTree([resolveInitialRoute(authStore.menu() ?? [], authStore.activeRolePurpose())]);
  }

  // Fallback checks (legacy or explicit data parameters)
  const requiredVentana = route.data?.['ventana'] as string | undefined;
  if (requiredVentana) {
    const requiredPermission = (route.data?.['permiso'] ?? 'leer') as 'leer' | 'escribir' | 'modificar' | 'eliminar';
    if (!authStore.hasAccess(requiredVentana, requiredPermission)) {
      return router.createUrlTree([resolveInitialRoute(authStore.menu() ?? [], authStore.activeRolePurpose())]);
    }
  }

  const requiredPurposes = route.data?.['purposes'] as string[] | undefined;
  if (requiredPurposes?.length && !requiredPurposes.includes(authStore.activeRolePurpose())) {
    return router.createUrlTree([resolveDashboardRoute(authStore.activeRolePurpose())]);
  }

  return true;
}

function getRoutePattern(route: ActivatedRouteSnapshot): string {
  const segments = route.pathFromRoot
    .map((r) => r.routeConfig?.path)
    .filter((path): path is string => !!path);
  return segments.join('/');
}

function isPurposeDashboardRoute(pattern: string, purpose: string | null): boolean {
  if (pattern === 'dashboard') {
    return purpose === 'PLATFORM_ADMIN';
  }

  if (pattern === 'admin/dashboard') {
    return purpose === 'COMPANY_ADMIN';
  }

  if (pattern === 'apoderado/dashboard') {
    return purpose === 'CLIENT_PORTAL';
  }

  if (pattern === 'empleado/dashboard') {
    return purpose === 'CUSTOM';
  }

  return false;
}
