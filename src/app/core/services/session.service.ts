import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';
import { AuthLoginData } from '../../models/response/auth-login-response.model';
import { AuthStore } from '../../store/auth.store';
import { AuthService } from './auth.service';
import { CompanySlugContext } from './company-slug-context.service';
import { NavigationService } from './navigation.service';

/**
 * Application service responsible for establishing the authenticated session.
 * Components and guards do not infer authentication from browser storage.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly navigationService = inject(NavigationService);
  private readonly slugContext = inject(CompanySlugContext);
  private initializationInFlight$: Observable<boolean> | null = null;

  /**
   * expectedSlug: el slug de empresa que la URL actual espera (la pantalla de login de
   * esa empresa). Las cookies de sesion son del NAVEGADOR entero, no de esta pestaña -
   * si ya hay una sesion valida pero es de OTRA empresa, nunca se establece en silencio
   * (eso llevaba a la persona al dashboard de la empresa equivocada sin darse cuenta,
   * con solo abrir /<otro-slug>/login en una pestaña nueva mientras seguia logueada en
   * otra empresa en otra pestaña). Sin expectedSlug (login "global", sin marca de
   * empresa) se preserva el comportamiento de siempre: cualquier sesion valida sirve.
   */
  initialize(expectedSlug?: string | null): Observable<boolean> {
    const status = this.authStore.sessionStatus();
    if (status === 'authenticated') {
      if (expectedSlug && this.authStore.companySlug() !== expectedSlug) return of(false);
      return of(true);
    }
    if (status === 'anonymous') return of(false);
    if (this.initializationInFlight$) return this.initializationInFlight$;

    this.authStore.beginSessionInitialization();
    this.initializationInFlight$ = this.authService.refreshToken().pipe(
      map(({ data }) => {
        if (expectedSlug && (data.companySlug ?? null) !== expectedSlug) {
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

    // La sesion real es la fuente de verdad del slug que se muestra en la
    // URL de aqui en adelante - incluso si se entro por el login "global"
    // sin slug, a partir de este punto toda navegacion interna lo lleva.
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
          ? { establishmentId: data.companyId, name: data.companyName, logoUrl: data.companyLogoUrl }
          : null,
      menu: data.menu ?? [],
      originalMenu: data.menu ?? [],
      simulatedRoleId: null,
    });

    // La navegación se refresca mediante su propio contrato. Durante la
    // transición se conserva el menú incluido en la sesión como fallback.
    this.navigationService.getEffectiveNavigation().subscribe({
      next: ({ data: navigation }) => this.authStore.setMenu(navigation ?? []),
      error: () => {}
    });
  }
}
