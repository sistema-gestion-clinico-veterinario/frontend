import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, retry, shareReplay, tap, timeout } from 'rxjs';
import { AuthLoginData } from '../../models/response/auth-login-response.model';
import { resolveInitialRoute } from '../routing/initial-route';
import { AuthStore } from '../../store/auth.store';
import { AuthService } from './auth.service';
import { CompanySlugContext } from './company-slug-context.service';
import { NavigationService } from './navigation.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly navigationService = inject(NavigationService);
  private readonly slugContext = inject(CompanySlugContext);
  private readonly router = inject(Router);
  private initializationInFlight$: Observable<boolean> | null = null;

  private readonly authChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('softvet-auth') : null;
  private closingSession = false;

  readonly logoutError = signal<string | null>(null);
  readonly sessionConflict = signal(false);

  logout(): void {
    if (this.closingSession) return;
    this.closingSession = true;
    this.logoutError.set(null);
    this.authService.logout().pipe(
      timeout(8000),
      retry({ count: 1, delay: 500 }),
      finalize(() => { this.closingSession = false; })
    ).subscribe({
      next: () => {
        const slug = this.authStore.companySlug();
        this.authStore.logout();
        this.authChannel?.postMessage({ type: 'logout', slug });
        this.router.navigateByUrl('/login', { replaceUrl: true });
      },
      error: () => this.logoutError.set(
        'No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo; si estás en un equipo compartido, no lo dejes sin cerrar la sesión.')
    });
  }

  closeLocalSession(notice?: string): void {
    const slug = this.authStore.companySlug();
    this.authStore.logout();
    this.authChannel?.postMessage({ type: 'logout', slug });
    this.router.navigateByUrl(notice ? `/login?authNotice=${notice}` : '/login', { replaceUrl: true });
  }

  changeRole(roleId: number): Observable<AuthLoginData> {
    return this.authService.switchRole(roleId).pipe(
      map(({ data }) => data),
      tap(data => {
        this.applyRoleChange(data);
        this.authChannel?.postMessage({ type: 'role-changed' });
      })
    );
  }

  listenForCrossTabEvents(): void {
    if (!this.authChannel) return;
    this.authChannel.onmessage = (event: MessageEvent) => {
      if (this.authStore.sessionStatus() === 'anonymous') return;
      if (event.data?.type === 'logout') {
        const cerrada = (event.data.slug ?? null) as string | null;
        if (cerrada !== (this.authStore.companySlug() ?? null)) return;
        this.authStore.logout();
        this.router.navigateByUrl('/login', { replaceUrl: true });
      } else if (event.data?.type === 'role-changed') {
        this.syncRoleFromServer();
      }
    };
  }

  /** Red de seguridad: si la sesión que llega no es de la clínica de esta pestaña (por ejemplo, una sesión abierta antes
   * de que cada clínica tuviera sus propias cookies), no se adopta. */
  endForOtherCompanySession(): void {
    this.authStore.logout();
    this.router.navigateByUrl('/login?authNotice=sesion_otra_clinica', { replaceUrl: true });
  }

  private syncRoleFromServer(): void {
    this.authService.currentSession().subscribe({
      next: ({ data }) => {
        if (data.activeRoleId !== this.authStore.activeRoleId()) this.applyRoleChange(data);
      },
      error: () => {}
    });
  }

  private applyRoleChange(data: AuthLoginData): void {
    this.establish(data, true);
    this.router.navigateByUrl(resolveInitialRoute(data.menu ?? [], data.activeRolePurpose), { replaceUrl: true });
  }

  /** platformOnly: la pantalla es del acceso de plataforma, así que una sesión de clínica no se adopta aunque exista. */
  initialize(expectedSlug?: string | null, platformOnly = false): Observable<boolean> {
    const status = this.authStore.sessionStatus();
    if (status === 'authenticated') {
      if (expectedSlug && this.authStore.companySlug() !== expectedSlug) {
        this.sessionConflict.set(true);
        return of(false);
      }
      if (platformOnly && this.authStore.companySlug()) {
        return of(false);
      }
      return of(true);
    }
    if (status === 'anonymous') return of(false);
    if (this.initializationInFlight$) return this.initializationInFlight$;

    this.authStore.beginSessionInitialization();
    this.initializationInFlight$ = this.authService.refreshToken().pipe(
      map(({ data }) => {
        if (expectedSlug && (data.companySlug ?? null) !== expectedSlug) {
          this.authStore.logout();
          this.sessionConflict.set(true);
          return false;
        }
        if (platformOnly && data.companySlug) {
          this.authStore.logout();
          return false;
        }
        this.establish(data, true);
        return true;
      }),
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
    const isPlatformAdmin = data.activeRolePurpose === 'PLATFORM_ADMIN';

    this.slugContext.setSlug(data.companySlug ?? null);

    this.authStore.setAuth({
      token: null,
      refreshToken: null,
      roles: data.roles ?? [],
      assignedRoles: data.assignedRoles ?? data.roles ?? [],
      availableRoles: data.availableRoles ?? [],
      originalRoles: data.assignedRoles ?? data.roles ?? [],
      activeRoleId: data.activeRoleId ?? null,
      activeRoleName: data.activeRoleName ?? data.roles?.[0] ?? null,
      activeRoleScope: data.activeRoleScope ?? null,
      activeRolePurpose: data.activeRolePurpose ?? null,
      permissionVersion: data.permissionVersion ?? 0,
      companyId: data.companyId,
      companyName: data.companyName,
      companySlug: data.companySlug ?? null,
      nombreCompleto: data.nombreCompleto,
      userType: data.userType,
      empleadoId: data.empleadoId ?? null,
      passwordChanged: data.passwordChanged,
      needsCompanySelection: data.needsCompanySelection,
      needsLegalAcceptance: data.needsLegalAcceptance,
      legalAcceptanceOverdue: data.legalAcceptanceOverdue,
      selectedEnterprise: preserveEnterprise && isPlatformAdmin
        ? this.authStore.selectedEnterprise()
        : data.companyId
          ? {
              establishmentId: data.companyId,
              name: data.companyName,
              logoUrl: data.companyLogoUrl,
              colorPrimario: data.companyColorPrimario ?? null,
            }
          : null,
      menu: data.menu ?? [],
      originalMenu: data.menu ?? [],
      simulatedRoleId: null,
    });
    this.navigationService.getEffectiveNavigation().subscribe({
      next: ({ data: navigation }) => this.authStore.setMenu(navigation ?? []),
      error: () => {}
    });
  }
}
