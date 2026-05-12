import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../store/auth.store';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const token = authStore.token();
  const roles = authStore.roles() ?? [];
  const requiredRoles = route.data?.['roles'] as string[] | undefined;

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.some((role) => roles.includes(role))) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
