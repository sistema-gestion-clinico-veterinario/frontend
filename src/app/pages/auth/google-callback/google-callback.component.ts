
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
    <div class="flex min-h-[100dvh] items-center justify-center bg-white" role="status" aria-live="polite">
      <div class="flex flex-col items-center px-6 text-center">
        <svg class="h-8 w-8 animate-spin text-[var(--brand-primary)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"></circle>
          <path class="opacity-90" fill="currentColor" d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"></path>
        </svg>
        <p class="mt-4 text-base font-bold text-slate-900">Completando el inicio de sesión</p>
        <p class="mt-1 text-sm text-slate-500">Estamos verificando tu acceso a la clínica.</p>
      </div>
    </div>
  `
})
export class GoogleCallbackComponent implements OnInit {
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
