import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SOFTVET_LOGO_URL } from '../../../core/constants/branding.constants';
import { AuthService, GOOGLE_PENDING_SLUG_KEY } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { resolveInitialRoute, resolveDashboardRoute } from '../../../core/routing/initial-route';


@Component({
  selector: 'app-google-callback',
  standalone: true,
  imports: [],
  templateUrl: './google-callback.component.html'
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
    window.location.replace(`${path}?authError=google_fallo`);
  }
}
