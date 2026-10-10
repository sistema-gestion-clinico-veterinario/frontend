
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, finalize, from, map, of, shareReplay, switchMap, tap, timeout } from 'rxjs';
import { AuthLoginResponse } from '../../../models/response/auth-login-response.model';
import { AuthService, GOOGLE_PENDING_SLUG_KEY } from '../../../core/services/auth.service';
import { CompanyService, CompanySearchResult } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveInitialRoute, resolveDashboardRoute } from '../../../layouts/main-layout/navbar/navbar.component';
import { SessionService } from '../../../core/services/session.service';
import { LoadingStore } from '../../../store/loading.store';
import { SOFTVET_BRAND_COLOR, SOFTVET_LOGO_URL, SOFTVET_NAME } from '../../../core/constants/branding.constants';
import { BrandThemeService } from '../../../core/services/brand-theme.service';

const DEFAULT_BRAND_COLOR = SOFTVET_BRAND_COLOR;
const DEFAULT_LOGO_URL = SOFTVET_LOGO_URL;
const DEFAULT_COMPANY_NAME = SOFTVET_NAME;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private slugContext = inject(CompanySlugContext);
  private sessionService = inject(SessionService);
  private loadingStore = inject(LoadingStore);
  private brandTheme = inject(BrandThemeService);

  authError: string | null = null;
  isSubmitting = false;
  showPassword = false;

  /** La empresa la resuelve la URL (slug), nunca una pantalla de seleccion
   * posterior al login. */
  slug: string | null = null;
  isAdminRoute = false;
  brandLoaded = false;
  brandNotFound = false;
  companyName = DEFAULT_COMPANY_NAME;
  // Nulo mientras se resuelve el slug: mostrar el logo generico del sistema
  // de entrada (aunque sea un instante, al recargar la pagina) se veia como
  // que "cargó mal" - mejor un espacio vacio/skeleton hasta tener el real.
  logoUrl: string | null = null;
  colorPrimario = DEFAULT_BRAND_COLOR;

  startingGoogle = false;
  private googleIntent: string | null = null;
  private googleIntentExpiresAt = 0;
  private googleIntentRequest$: Observable<string> | null = null;
  authNotice = '';
  noticeTitle = '';
  showNotice = false;

  showReactivar = false;
  reactivando = false;
  reactivableHasta: string | null = null;
  private ticketDeReactivacion: string | null = null;
  private credencialesPendientes: { username: string; password: string } | null = null;

  private static readonly NOTICE_TITLES: Record<string, string> = {
    sesion_otra_clinica: 'Sesión de otra clínica',
  };

  private static readonly NOTICES: Record<string, string> = {
    sesion_otra_clinica: 'La sesión que tenía este navegador no corresponde a esta clínica. Inicia sesión de nuevo para continuar; las sesiones de tus otras clínicas no se cierran.',
  };

  private static readonly GOOGLE_ERROR_MESSAGES: Record<string, string> = {
    google_cancelado: 'Inicio de sesión con Google cancelado.',
    google_cuenta_cerrada: 'Tu cuenta está cerrada y ya no se puede reactivar desde aquí. Contacta al administrador de la clínica.',
    google_email_no_verificado: 'Tu cuenta de Google no tiene el correo verificado.',
    google_sin_acceso_clinica: 'Tu cuenta de Google no está registrada en esta veterinaria. Solicita acceso al administrador de la clínica o continúa con otra cuenta de Google.',
    google_cuenta_dada_de_baja: 'Tu acceso a esta veterinaria ya no está activo. Si crees que es un error, contacta al administrador de la clínica.',
    google_cuenta_suspendida: 'Tu acceso a esta veterinaria está suspendido. Contacta al administrador de la clínica.',
    google_cuenta_no_habilitada: 'Tu cuenta no puede ingresar por ahora. Contacta al administrador de la clínica.',
    google_fallo: 'No se pudo iniciar sesión con Google. Intenta nuevamente.',
  };

  ngOnInit() {
    this.brandTheme.applyCompanyColor(DEFAULT_BRAND_COLOR);
    this.isAdminRoute = this.router.url.startsWith('/admin/login');
    this.slug = this.isAdminRoute ? null : this.slugContext.slug();

    this.aplicarMensajesDeLaUrl(
      this.route.snapshot.queryParamMap.get('authNotice'),
      this.route.snapshot.queryParamMap.get('authError'),
      this.leerTicketDeReactivacion());

    if (this.slug) {
      this.loadBranding(this.slug);
      this.prepareGoogleLogin();
    } else {
      // Sin slug (login global o SuperAdmin): no hay empresa que marcar, usa
      // el logo/color por defecto del sistema de una vez.
      this.logoUrl = DEFAULT_LOGO_URL;
      this.brandLoaded = true;
      if (this.missingSlug) {
        this.setupClinicSearch();
      }
    }

    // Con slug, solo se reusa una sesion existente si es DE ESTA empresa - las cookies
    // son del navegador entero (compartidas entre pestañas), asi que sin este chequeo
    // abrir /<otro-slug>/login mientras se sigue logueado en otra empresa en otra
    // pestaña autenticaba en silencio contra la empresa equivocada.
    this.sessionService.initialize(this.slug, this.isAdminRoute).subscribe((authenticated) => {
      if (!authenticated) return;
      this.navigateToInitialRoute();
    });
  }

  private loadBranding(slug: string): void {
    this.companyService.getBrandingBySlug(slug).subscribe({
      next: ({ data }) => {
        this.companyName = data?.name || DEFAULT_COMPANY_NAME;
        this.logoUrl = data?.logoUrl || DEFAULT_LOGO_URL;
        this.colorPrimario = data?.colorPrimario || DEFAULT_BRAND_COLOR;
        this.brandTheme.applyCompanyColor(data?.colorPrimario);
        this.brandLoaded = true;
      },
      error: () => {
        this.brandTheme.applyCompanyColor(DEFAULT_BRAND_COLOR);
        this.companyName = DEFAULT_COMPANY_NAME;
        this.logoUrl = DEFAULT_LOGO_URL;
        this.brandNotFound = true;
        this.brandLoaded = true;
      }
    });
  }

  loginForm = inject(FormBuilder).group({
    username: ['', [Validators.required, noLeadingTrailingSpaceValidator(), Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.maxLength(72)]]
  });

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /** Sin slug (y sin ser la ruta de SuperAdmin) no hay forma de saber contra que
   * empresa autenticar - aislamiento total entre empresas, ya no existe un login
   * "global". El backend rechaza cualquier intento sin slug de todos modos; esto solo
   * evita mostrarle a la persona un formulario que nunca va a funcionar. */
  get missingSlug(): boolean {
    return !this.isAdminRoute && !this.slug;
  }

  /** Buscador de clinica que se muestra cuando falta el slug - reemplaza al
   * formulario, que el backend rechazaria de todos modos sin empresa resuelta. */
  clinicSearchControl = new FormControl('');
  clinicResults: CompanySearchResult[] = [];
  searchingClinics = false;

  private setupClinicSearch(): void {
    this.clinicSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        const trimmed = (query ?? '').trim();
        if (trimmed.length < 2) {
          this.clinicResults = [];
          this.searchingClinics = false;
          return of(null);
        }
        this.searchingClinics = true;
        return this.companyService.searchByName(trimmed).pipe(
          catchError(() => of(null))
        );
      })
    ).subscribe((response) => {
      this.searchingClinics = false;
      this.clinicResults = response?.data ?? [];
    });
  }

  /** Navegacion "dura" (no SPA) a proposito: el SlugUrlSerializer le quita el slug a
   * la URL ANTES de que el Router la vea, asi que "/login" (donde ya estamos, sin slug)
   * y "/<slug>/login" resuelven al mismo UrlTree interno - Angular trata la navegacion
   * como "misma URL" y la ignora por defecto (onSameUrlNavigation: 'ignore'), dejando el
   * boton sin efecto. Recargar la pagina evita ese caso especial y reinicia el componente
   * ya con el slug correcto. */
  goToClinic(result: CompanySearchResult): void {
    window.location.href = `/${result.slug}/login`;
  }

  submit() {
    if (this.missingSlug) return;
    const rawUsername = (document.getElementById('username') as HTMLInputElement)?.value ?? '';
    const rawPassword = (document.getElementById('password') as HTMLInputElement)?.value ?? '';
    this.loginForm.get('username')?.setValue(rawUsername, { emitEvent: false });
    this.loginForm.get('password')?.setValue(rawPassword, { emitEvent: false });

    const hasUntrimmedUsername = rawUsername !== rawUsername.trim();
    const hasUntrimmedPassword = rawPassword !== rawPassword.trim();

    if (hasUntrimmedUsername || hasUntrimmedPassword) {
      if (hasUntrimmedUsername) {
        this.authError = 'El usuario no debe contener espacios al inicio o al final.';
        this.loginForm.get('username')?.markAsTouched();
      } else {
        this.authError = 'La contraseña no debe iniciar ni terminar con espacios.';
        this.loginForm.get('password')?.markAsTouched();
      }
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.authError = null;
    this.credencialesPendientes = { username: rawUsername, password: rawPassword };

    // La empresa siempre la resuelve la URL (slug) - ya no existe login "global" sin
    // marca de empresa (aislamiento total entre empresas).
    const request$ = this.isAdminRoute
      ? this.authService.adminLogin({ username: rawUsername, password: rawPassword })
      : this.authService.login({ slug: this.slug!, username: rawUsername, password: rawPassword });

    this.completarInicioDeSesion(request$);
  }

  reactivar(): void {
    if (this.reactivando || (!this.ticketDeReactivacion && !this.credencialesPendientes)) return;
    this.reactivando = true;
    const request$ = this.ticketDeReactivacion
      ? this.authService.reactivateWithGoogle(this.ticketDeReactivacion)
      : this.authService.login({ slug: this.slug!, ...this.credencialesPendientes!, reactivarCuenta: true });
    this.completarInicioDeSesion(request$);
  }

  cerrarReactivar(): void {
    if (this.reactivando) return;
    this.showReactivar = false;
    this.ticketDeReactivacion = null;
    this.credencialesPendientes = null;
    this.limpiarClave();
  }

  get fechaLimiteDeReactivacion(): string {
    const dia = (this.reactivableHasta ?? '').slice(0, 10).split('-');
    return dia.length === 3 ? `${dia[2]}/${dia[1]}/${dia[0]}` : '';
  }

  private completarInicioDeSesion(request$: Observable<AuthLoginResponse>): void {
    this.isSubmitting = true;
    this.loadingStore.show();

    request$.pipe(
      timeout(15000),
      switchMap(({ data }) => {
        const roles = data.roles ?? [];
        if (roles.length === 0) {
          this.authStore.logout();
          throw new MissingRoleError();
        }

        this.sessionService.establish(data);
        this.showReactivar = false;
        this.reactivando = false;
        this.ticketDeReactivacion = null;
        this.credencialesPendientes = null;
        sessionStorage.removeItem('pw_modal_dismissed');
        // La guarda de acceso mostrará primero el aviso vigente de la clínica.
        // Los documentos de la plataforma permanecen en la campana de notificaciones
        // y, si su plazo realmente venció, el backend puede restringir las operaciones
        // protegidas mediante TERMS_NOT_ACCEPTED.
        const targetUrl = resolveInitialRoute(data.menu ?? [], data.activeRolePurpose);
        return from(this.navigateWithFallback(targetUrl, data.activeRolePurpose));
      }),
      finalize(() => {
        this.isSubmitting = false;
        this.loadingStore.hide();
      })
    ).subscribe({
      next: () => {},
      error: (error) => {
        if (!this.reactivando && error?.status === 409 && error?.error?.data?.code === 'CUENTA_CERRADA') {
          this.reactivableHasta = error.error.data.reactivableHasta ?? null;
          this.showReactivar = true;
          return;
        }
        this.showReactivar = false;
        this.reactivando = false;
        this.ticketDeReactivacion = null;
        this.credencialesPendientes = null;
        this.authError = this.resolveLoginError(error);
        // Contraseña incorrecta, cuenta que debe restablecerla, etc.: nunca dejar la contraseña
        // fallida escrita en el campo. Se excluye el error de red/timeout porque ahí la
        // contraseña no era el problema y reintentar con el mismo valor es razonable.
        if (!(error?.name === 'TimeoutError' || error?.status === 0)) {
          this.limpiarClave();
        }
      },
    });
  }

  private limpiarClave(): void {
    this.loginForm.get('password')?.setValue('', { emitEvent: false });
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    if (passwordInput) passwordInput.value = '';
  }

  private leerTicketDeReactivacion(): string | null {
    const ticket = new URLSearchParams(this.route.snapshot.fragment ?? '').get('reactivar');
    if (ticket && typeof history !== 'undefined') {
      history.replaceState(history.state, '', location.pathname + location.search);
    }
    return ticket;
  }

  /** El intent se prepara silenciosamente al cargar la página. En el uso normal este clic
   * navega inmediatamente a Google; si la preparación aún no terminó, comparte esa misma
   * solicitud sin mostrar el preloader global ni una pantalla intermedia. */
  continueWithGoogle(): void {
    if (this.startingGoogle || !this.slug) return;
    this.authError = null;
    this.startingGoogle = true;
    sessionStorage.setItem(GOOGLE_PENDING_SLUG_KEY, this.slug);
    this.googleIntentFor(this.slug).subscribe({
      next: (intent) => this.redirectTo(this.authService.googleStartUrl(intent)),
      error: () => {
        this.startingGoogle = false;
        sessionStorage.removeItem(GOOGLE_PENDING_SLUG_KEY);
        this.authError = LoginComponent.GOOGLE_ERROR_MESSAGES['google_fallo'];
      }
    });
  }

  private prepareGoogleLogin(): void {
    if (!this.slug || this.isAdminRoute) return;
    this.googleIntentFor(this.slug).subscribe({ error: () => {} });
  }

  private googleIntentFor(slug: string): Observable<string> {
    if (this.googleIntent && Date.now() < this.googleIntentExpiresAt) {
      return of(this.googleIntent);
    }
    if (this.googleIntentRequest$) return this.googleIntentRequest$;

    this.googleIntentRequest$ = this.authService.createGoogleIntent({ slug }).pipe(
      map(({ data }) => data.intent),
      tap((intent) => {
        this.googleIntent = intent;
        // El backend permite cinco minutos. Se renueva un minuto antes para no
        // enviar a Google un código que pueda vencer durante la elección de cuenta.
        this.googleIntentExpiresAt = Date.now() + 4 * 60_000;
      }),
      finalize(() => { this.googleIntentRequest$ = null; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.googleIntentRequest$;
  }

  redirectTo(url: string): void {
    // replace evita que "Atrás" vuelva a un login intermedio.
    window.location.replace(url);
  }

  closeNotice(): void {
    this.showNotice = false;
  }

  aplicarMensajesDeLaUrl(codigoDeAviso: string | null, codigoDeError: string | null, ticketDeReactivacion: string | null = null): void {
    if (codigoDeError === 'google_cuenta_cerrada' && ticketDeReactivacion) {
      this.ticketDeReactivacion = ticketDeReactivacion;
      this.showReactivar = true;
      return;
    }
    const codigo = LoginComponent.NOTICES[codigoDeAviso ?? ''] ? codigoDeAviso
      : LoginComponent.NOTICES[codigoDeError ?? ''] ? codigoDeError : null;
    this.authNotice = codigo ? LoginComponent.NOTICES[codigo] : '';
    this.noticeTitle = codigo ? LoginComponent.NOTICE_TITLES[codigo] ?? '' : '';
    this.showNotice = !!this.authNotice;
    if (codigoDeError && !LoginComponent.NOTICES[codigoDeError]) {
      this.authError = LoginComponent.GOOGLE_ERROR_MESSAGES[codigoDeError]
        ?? 'No se pudo iniciar sesión con Google. Intenta nuevamente.';
    }
  }

  private resolveLoginError(error: any): string {
    if (error instanceof MissingRoleError) {
      return 'Tu usuario no tiene ningún rol asignado. Contacta al administrador.';
    }
    if (error?.name === 'TimeoutError' || error?.status === 0) {
      return 'No se pudo conectar con el servidor. Intenta nuevamente en unos segundos.';
    }

    const payload = error?.error;
    const serverMessage = typeof payload === 'string'
      ? payload
      : payload?.message || payload?.error;

    return serverMessage || 'Usuario o contraseña incorrectos.';
  }

  private navigateToInitialRoute(): void {
    const targetUrl = resolveInitialRoute(this.authStore.menu() ?? [], this.authStore.activeRolePurpose());
    this.navigateWithFallback(targetUrl, this.authStore.activeRolePurpose()).subscribe();
  }

  /**
   * Some vistas configured in the menu may not have a matching Angular route
   * (e.g. a view removed or never built). If navigation silently fails
   * (navigateByUrl resolves false, caught by the wildcard route), fall back
   * to the purpose-based dashboard instead of stranding the user on /login.
   */
  private navigateWithFallback(targetUrl: string, purpose?: string | null) {
    return from(this.router.navigateByUrl(targetUrl)).pipe(
      switchMap((navigated) => {
        if (navigated || this.router.url === targetUrl) return from(Promise.resolve(true));
        const fallbackUrl = resolveDashboardRoute(purpose as any);
        return from(this.router.navigateByUrl(fallbackUrl));
      })
    );
  }
}

class MissingRoleError extends Error {}
