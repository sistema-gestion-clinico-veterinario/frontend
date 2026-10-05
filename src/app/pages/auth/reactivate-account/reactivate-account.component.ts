import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { SOFTVET_BRAND_COLOR, SOFTVET_LOGO_URL, SOFTVET_NAME } from '../../../core/constants/branding.constants';

@Component({
  selector: 'app-reactivate-account',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './reactivate-account.component.html'
})
export class ReactivateAccountComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly companyService = inject(CompanyService);
  private readonly slugContext = inject(CompanySlugContext);

  slug: string | null = this.slugContext.slug();
  companyName = SOFTVET_NAME;
  logoUrl: string | null = SOFTVET_LOGO_URL;
  colorPrimario = SOFTVET_BRAND_COLOR;

  token = '';
  readonly state = signal<'ready' | 'working' | 'done' | 'error'>('ready');
  readonly message = signal('');

  ngOnInit(): void {
    if (this.slug) {
      this.companyService.getBrandingBySlug(this.slug).subscribe({
        next: ({ data }) => {
          this.companyName = data?.name || SOFTVET_NAME;
          this.logoUrl = data?.logoUrl || SOFTVET_LOGO_URL;
          this.colorPrimario = data?.colorPrimario || SOFTVET_BRAND_COLOR;
        },
        error: () => {}
      });
    }
    const fragment = new URLSearchParams(this.route.snapshot.fragment ?? '');
    this.token = fragment.get('token') ?? '';
    if (fragment.has('token')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (!this.token) {
      this.state.set('error');
      this.message.set('El enlace no es válido. Usa el botón del correo que te enviamos al cerrar tu cuenta.');
    }
  }

  reactivate(): void {
    if (!this.token || this.state() === 'working') return;
    this.state.set('working');
    this.authService.reactivateAccount(this.token).subscribe({
      next: ({ message }) => {
        this.state.set('done');
        this.message.set(message || 'Reactivamos tu cuenta. Ya puedes iniciar sesión.');
      },
      error: (err) => {
        this.state.set('error');
        this.message.set(err.error?.message
          || 'No pudimos reactivar tu cuenta. Inténtalo de nuevo en unos minutos.');
      }
    });
  }
}
