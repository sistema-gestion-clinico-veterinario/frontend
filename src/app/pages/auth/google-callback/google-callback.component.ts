
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SOFTVET_LOGO_URL } from '../../../core/constants/branding.constants';
import { AuthService, GOOGLE_PENDING_SLUG_KEY } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { resolveInitialRoute, resolveDashboardRoute } from '../../../layouts/main-layout/navbar/navbar.component';

/** Adonde el backend redirige al navegador tras /auth/google/callback: aquí solo se
 * canjea el código de un solo uso por la sesión real (mismo resultado que un login
 * normal), nunca queda expuesto un token en la URL. */
@Component({
  selector: 'app-google-callback',
  standalone: true,
  imports: [],
  template: `
    <div
      class="flex min-h-[100dvh] items-center justify-center bg-white"
      role="status"
      aria-live="polite"
      aria-label="Iniciando sesión"
    >
      <img
        [src]="logoUrl"
        alt="SoftVet"
        class="loader-pulse h-24 w-24 object-contain"
      />
    </div>
  `
})
export class GoogleCallbackComponent implements OnInit {
  protected readonly logoUrl = SOFTVET_LOGO_URL;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sessionService = inject(SessionService);

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.returnToLogin();
      return;
    }

    this.authService.exchangeGoogleCode(code).subscribe({
      next: ({ data }) => {
        const roles = data.roles ?? [];
        if (roles.length === 0) {
          this.returnToLogin();
          return;
        }
        this.sessionService.establish(data);
        sessionStorage.removeItem(GOOGLE_PENDING_SLUG_KEY);
        const targetUrl = resolveInitialRoute(data.menu ?? [], data.activeRolePurpose);
        this.router.navigateByUrl(targetUrl).then((navigated) => {
          if (!navigated) {
            this.router.navigateByUrl(resolveDashboardRoute(data.activeRolePurpose));
          }
        });
      },
      error: () => this.returnToLogin()
    });
  }

  private returnToLogin(): void {
    const slug = sessionStorage.getItem(GOOGLE_PENDING_SLUG_KEY);
    sessionStorage.removeItem(GOOGLE_PENDING_SLUG_KEY);
    const path = slug ? `/${encodeURIComponent(slug)}/login` : '/login';
    // La navegación completa permite que el serializador vuelva a resolver el
    // contexto de empresa antes de pintar el login y evita mostrar la marca global.
    window.location.replace(`${path}?authError=google_fallo`);
  }
}
