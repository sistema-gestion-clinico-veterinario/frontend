
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, from, of, switchMap, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService, CompanySearchResult } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveInitialRoute, resolveDashboardRoute } from '../../../layouts/main-layout/navbar/navbar.component';
import { SessionService } from '../../../core/services/session.service';
import { LoadingStore } from '../../../store/loading.store';

const DEFAULT_BRAND_COLOR = '#006BA8';
const DEFAULT_LOGO_URL = 'https://toqqwxveqxhlottwetev.supabase.co/storage/v1/object/public/vargas_vet/Fondo%20de%20Pantalla%20Computador%20Simple%20Beige%20(7).png';
const DEFAULT_COMPANY_NAME = 'SystemVet';

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

  private static readonly GOOGLE_ERROR_MESSAGES: Record<string, string> = {
    google_cancelado: 'Inicio de sesión con Google cancelado.',
    google_email_no_verificado: 'Tu cuenta de Google no tiene el correo verificado.',
    google_fallo: 'No se pudo iniciar sesión con Google. Intenta nuevamente.',
  };

  ngOnInit() {
    this.isAdminRoute = this.router.url.startsWith('/admin/login');
    this.slug = this.isAdminRoute ? null : this.slugContext.slug();

    const authErrorCode = this.route.snapshot.queryParamMap.get('authError');
    if (authErrorCode) {
      this.authError = LoginComponent.GOOGLE_ERROR_MESSAGES[authErrorCode]
        ?? 'No se pudo iniciar sesión con Google. Intenta nuevamente.';
    }

    if (this.slug) {
      this.loadBranding(this.slug);
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
    this.sessionService.initialize(this.slug).subscribe((authenticated) => {
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
        this.brandLoaded = true;
      },
      error: () => {
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

  goToClinic(result: CompanySearchResult): void {
    this.router.navigateByUrl(`/${result.slug}/login`);
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
    this.isSubmitting = true;
    this.loadingStore.show();

    // La empresa siempre la resuelve la URL (slug) - ya no existe login "global" sin
    // marca de empresa (aislamiento total entre empresas).
    const request$ = this.isAdminRoute
      ? this.authService.adminLogin({ username: rawUsername, password: rawPassword })
      : this.authService.login({ slug: this.slug!, username: rawUsername, password: rawPassword });

    request$.pipe(
      timeout(15000),
      switchMap(({ data }) => {
        const roles = data.roles ?? [];
        if (roles.length === 0) {
          this.authStore.logout();
          throw new MissingRoleError();
        }

        this.sessionService.establish(data);
        sessionStorage.removeItem('pw_modal_dismissed');
        const targetUrl = data.legalAcceptanceOverdue
          ? '/legal/accept'
          : resolveInitialRoute(data.menu ?? [], data.activeRolePurpose);
        return from(this.navigateWithFallback(targetUrl, data.activeRolePurpose));
      }),
      finalize(() => {
        this.isSubmitting = false;
        this.loadingStore.hide();
      })
    ).subscribe({
      next: () => {},
      error: (error) => {
        this.authError = this.resolveLoginError(error);
        // Contraseña incorrecta, cuenta que debe restablecerla, etc.: nunca dejar la contraseña
        // fallida escrita en el campo. Se excluye el error de red/timeout porque ahí la
        // contraseña no era el problema y reintentar con el mismo valor es razonable.
        if (!(error?.name === 'TimeoutError' || error?.status === 0)) {
          this.loginForm.get('password')?.setValue('', { emitEvent: false });
          const passwordInput = document.getElementById('password') as HTMLInputElement | null;
          if (passwordInput) passwordInput.value = '';
        }
      },
    });
  }

  /** El slug (si hay) viaja como "state" para que /auth/google/callback sepa contra qué
   * empresa resolver la cuenta al volver - Google lo devuelve intacto en la redirección. */
  continueWithGoogle(): void {
    const params = new URLSearchParams({
      client_id: environment.googleClientId,
      redirect_uri: environment.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });
    if (this.slug) {
      params.set('state', this.slug);
    }
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
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
