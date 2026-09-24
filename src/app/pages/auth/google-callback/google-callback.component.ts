
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
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
    <div class="flex min-h-screen items-center justify-center bg-white">
      <p class="text-sm font-medium text-slate-500">Completando el inicio de sesión con Google...</p>
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
      this.router.navigateByUrl('/login?authError=google_fallo');
      return;
    }

    this.authService.exchangeGoogleCode(code).subscribe({
      next: ({ data }) => {
        const roles = data.roles ?? [];
        if (roles.length === 0) {
          this.router.navigateByUrl('/login?authError=google_fallo');
          return;
        }
        this.sessionService.establish(data);
        const targetUrl = data.legalAcceptanceOverdue
          ? '/legal/accept'
          : resolveInitialRoute(data.menu ?? [], data.activeRolePurpose);
        this.router.navigateByUrl(targetUrl).then((navigated) => {
          if (!navigated) {
            this.router.navigateByUrl(resolveDashboardRoute(data.activeRolePurpose));
          }
        });
      },
      error: () => this.router.navigateByUrl('/login?authError=google_fallo')
    });
  }
}
