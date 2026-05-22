import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { resolveDashboardRoute, resolveInitialRoute } from '../../layouts/main-layout/navbar/navbar.component';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const token = authStore.token();

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  const currentRoles = authStore.roles() ?? [];
  const currentMenu = authStore.menu() ?? [];
  if (currentRoles.length === 0 && currentMenu.length === 0) {
    authStore.logout();
    router.navigate(['/login']);
    return false;
  }

  // Dynamic route pattern access check
  const pattern = getRoutePattern(route);
  if (pattern && !authStore.hasRouteAccess(pattern)) {
    router.navigate([resolveInitialRoute(authStore.roles() ?? [], authStore.menu() ?? [])]);
    return false;
  }

  // Fallback checks (legacy or explicit data parameters)
  const requiredVentana = route.data?.['ventana'] as string | undefined;
  if (requiredVentana) {
    if (!authStore.hasAccess(requiredVentana, 'leer')) {
      router.navigate([resolveInitialRoute(authStore.roles() ?? [], authStore.menu() ?? [])]);
      return false;
    }
  }

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  const roles = authStore.roles() ?? [];
  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.some((role) => roles.includes(role))) {
    router.navigate([resolveDashboardRoute(roles)]);
    return false;
  }

  return true;
};

function getRoutePattern(route: ActivatedRouteSnapshot): string {
  const segments = route.pathFromRoot
    .map((r) => r.routeConfig?.path)
    .filter((path): path is string => !!path);
  return segments.join('/');
}

