import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthLoginData } from '../../models/response/auth-login-response.model';
import { AuthStore } from '../../store/auth.store';
import { AuthService } from './auth.service';

/**
 * Application service responsible for establishing the authenticated session.
 * Components and guards do not infer authentication from browser storage.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private initializationInFlight$: Observable<boolean> | null = null;

  initialize(): Observable<boolean> {
    const status = this.authStore.sessionStatus();
    if (status === 'authenticated') return of(true);
    if (status === 'anonymous') return of(false);
    if (this.initializationInFlight$) return this.initializationInFlight$;

    this.authStore.beginSessionInitialization();
    this.initializationInFlight$ = this.authService.refreshToken().pipe(
      tap(({ data }) => this.establish(data, true)),
      map(() => true),
      catchError(() => {
        this.authStore.logout();
        return of(false);
      }),
      finalize(() => { this.initializationInFlight$ = null; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.initializationInFlight$;
  }

  establish(data: AuthLoginData, preserveEnterprise = false): void {
    const isSuperAdmin = (data.roles ?? []).some((role) =>
      role === 'ROLE_SUPER_ADMIN' || role === 'SUPER_ADMIN'
    );

    this.authStore.setAuth({
      token: null,
      refreshToken: null,
      roles: data.roles ?? [],
      assignedRoles: data.assignedRoles ?? data.roles ?? [],
      originalRoles: data.assignedRoles ?? data.roles ?? [],
      companyId: data.companyId,
      companyName: data.companyName,
      nombreCompleto: data.nombreCompleto,
      userType: data.userType,
      empleadoId: data.empleadoId ?? null,
      passwordChanged: data.passwordChanged,
      needsCompanySelection: data.needsCompanySelection,
      selectedEnterprise: preserveEnterprise && isSuperAdmin
        ? this.authStore.selectedEnterprise()
        : null,
      menu: data.menu ?? [],
      originalMenu: data.menu ?? [],
      simulatedRoleId: null,
    });
  }
}
