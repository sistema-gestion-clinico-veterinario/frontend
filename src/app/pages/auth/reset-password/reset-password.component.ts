import { Component, OnInit, inject } from '@angular/core';

import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { strongPasswordValidators } from '../../../core/validators/password-policy.validator';

const DEFAULT_BRAND_COLOR = '#006BA8';
const DEFAULT_LOGO_URL = 'https://toqqwxveqxhlottwetev.supabase.co/storage/v1/object/public/vargas_vet/Fondo%20de%20Pantalla%20Computador%20Simple%20Beige%20(7).png';
const DEFAULT_COMPANY_NAME = 'SoftVet';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly companyService = inject(CompanyService);
  private readonly slugContext = inject(CompanySlugContext);

  /** La empresa la resuelve la URL (slug), igual que login/forgot-password/verify-email -
   * el enlace de reset ya lo incluye (ver UsuarioServiceImpl.issuePasswordResetToken). */
  slug: string | null = this.slugContext.slug();
  companyName = DEFAULT_COMPANY_NAME;
  logoUrl: string | null = null;
  colorPrimario = DEFAULT_BRAND_COLOR;
  brandNotFound = false;

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  token = '';
  showPassword = false;

  resetForm = this.fb.group({
    password: ['', strongPasswordValidators()],
    confirmPassword: ['', strongPasswordValidators()]
  }, { validators: this.passwordMatchValidator });

  isTokenValid = true;
  isValidating = true;

  ngOnInit(): void {
    if (this.slug) {
      this.companyService.getBrandingBySlug(this.slug).subscribe({
        next: ({ data }) => {
          this.companyName = data?.name || DEFAULT_COMPANY_NAME;
          this.logoUrl = data?.logoUrl || DEFAULT_LOGO_URL;
          this.colorPrimario = data?.colorPrimario || DEFAULT_BRAND_COLOR;
        },
        error: () => {
          this.brandNotFound = true;
          this.logoUrl = DEFAULT_LOGO_URL;
        }
      });
    } else {
      this.logoUrl = DEFAULT_LOGO_URL;
    }

    this.route.queryParams.subscribe(params => {
      const fragmentParams = new URLSearchParams(this.route.snapshot.fragment ?? '');
      this.token = fragmentParams.get('token') ?? params['token'] ?? '';
      if (fragmentParams.has('token')) {
        history.replaceState(null, '', location.pathname + location.search);
      }
      if (!this.token) {
        this.isTokenValid = false;
        this.isValidating = false;
        this.errorMessage = 'El enlace de recuperación es inválido o no contiene un token.';
      } else {
        this.authService.validateResetToken(this.token).subscribe({
          next: (res: any) => {
            this.isValidating = false;
            if (!res.data) {
              this.isTokenValid = false;
              this.errorMessage = 'El token ha expirado o ya fue utilizado. Por favor solicite uno nuevo.';
            }
          },
          error: () => {
            this.isValidating = false;
            this.isTokenValid = false;
            this.errorMessage = 'El token ha expirado o es inválido. Por favor solicite uno nuevo.';
          }
        });
      }
    });
  }

  get password() { return this.resetForm.get('password'); }
  get confirmPassword() { return this.resetForm.get('confirmPassword'); }

  passwordMatchValidator(g: any) {
    return g.get('password').value === g.get('confirmPassword').value
      ? null : { mismatch: true };
  }

  submit() {
    const rawPwd = this.resetForm.getRawValue().password ?? '';
    if (rawPwd !== rawPwd.trim()) {
      this.errorMessage = 'La contraseña no debe iniciar ni terminar con espacios.';
      return;
    }
    if (this.resetForm.invalid || !this.token) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const newPassword = this.resetForm.value.password!;

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.successMessage = res.message || 'Contraseña actualizada correctamente.';
        this.resetForm.reset();
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Error al restablecer la contraseña.';
      }
    });
  }
}
