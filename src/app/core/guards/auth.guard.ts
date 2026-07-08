import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { resolveDashboardRoute, resolveInitialRoute } from '../../layouts/main-layout/navbar/navbar.component';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const hasSession = authStore.roles().length > 0 || authStore.nombreCompleto() !== null;

  if (!hasSession) {
    return router.createUrlTree(['/login']);
  }

  return validateAccess(route, authStore, router);
};

function validateAccess(route: ActivatedRouteSnapshot, authStore: any, router: Router) {
  const currentRoles = authStore.roles() ?? [];
  const currentMenu = authStore.menu() ?? [];
  if (currentRoles.length === 0 && currentMenu.length === 0) {
    authStore.logout();
    return router.createUrlTree(['/login']);
  }

  // Dynamic route pattern access check
  const pattern = getRoutePattern(route);
  if (pattern && !isRoleDashboardRoute(pattern, currentRoles) && !authStore.hasRouteAccess(pattern)) {
    return router.createUrlTree([resolveInitialRoute(authStore.roles() ?? [], authStore.menu() ?? [])]);
  }

  // Fallback checks (legacy or explicit data parameters)
  const requiredVentana = route.data?.['ventana'] as string | undefined;
  if (requiredVentana) {
    if (!authStore.hasAccess(requiredVentana, 'leer')) {
      return router.createUrlTree([resolveInitialRoute(authStore.roles() ?? [], authStore.menu() ?? [])]);
    }
  }

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  const roles = authStore.roles() ?? [];
  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.some((role) => roles.includes(role))) {
    return router.createUrlTree([resolveDashboardRoute(roles)]);
  }

  return true;
}

function getRoutePattern(route: ActivatedRouteSnapshot): string {
  const segments = route.pathFromRoot
    .map((r) => r.routeConfig?.path)
    .filter((path): path is string => !!path);
  return segments.join('/');
}

function isRoleDashboardRoute(pattern: string, roles: string[]): boolean {
  if (pattern === 'dashboard') {
    return roles.some(role => role === 'ROLE_SUPER_ADMIN' || role === 'SUPER_ADMIN');
  }

  if (pattern === 'admin/dashboard') {
    return roles.some(role => role === 'ROLE_ADMIN' || role === 'ADMIN');
  }

  if (pattern === 'apoderado/dashboard') {
    return roles.some(role => role.includes('APODERADO') || role.includes('CLIENTE'));
  }

  if (pattern === 'empleado/dashboard') {
    return roles.some(role => !role.includes('ADMIN') && !role.includes('APODERADO') && !role.includes('CLIENTE'));
  }

  return false;
}
