import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize, from, switchMap, timeout } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveInitialRoute, resolveDashboardRoute } from '../../../layouts/main-layout/navbar/navbar.component';
import { SessionService } from '../../../core/services/session.service';
import { LoadingStore } from '../../../store/loading.store';

const DEFAULT_BRAND_COLOR = '#006BA8';
const DEFAULT_LOGO_URL = 'https://toqqwxveqxhlottwetev.supabase.co/storage/v1/object/public/vargas_vet/84b31891-44b7-4621-b272-58ae0f11e2d4-Photoroom.png';
const DEFAULT_COMPANY_NAME = 'SystemVet';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
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
  logoUrl: string | null = DEFAULT_LOGO_URL;
  colorPrimario = DEFAULT_BRAND_COLOR;

  /** El fallback sin slug (enlace raiz, marcadores viejos) no puede loguear a
   * nadie: no hay a que empresa dirigir la sesion. */
  get canSubmit(): boolean {
    return this.isAdminRoute || !!this.slug;
  }

  ngOnInit() {
    this.isAdminRoute = this.router.url.startsWith('/admin/login');
    this.slug = this.isAdminRoute ? null : this.route.snapshot.paramMap.get('slug');

    if (this.slug) {
      this.loadBranding(this.slug);
    } else {
      this.brandLoaded = true;
    }

    this.sessionService.initialize().subscribe((authenticated) => {
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
    username: ['', [Validators.required, noLeadingTrailingSpaceValidator(), Validators.maxLength(50)]],
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

  submit() {
    if (!this.canSubmit) return;

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
      },
    });
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
