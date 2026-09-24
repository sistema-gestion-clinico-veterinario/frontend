import { Component, OnInit, inject } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';

const DEFAULT_BRAND_COLOR = '#006BA8';
const DEFAULT_LOGO_URL = 'https://toqqwxveqxhlottwetev.supabase.co/storage/v1/object/public/vargas_vet/Fondo%20de%20Pantalla%20Computador%20Simple%20Beige%20(7).png';
const DEFAULT_COMPANY_NAME = 'SystemVet';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly companyService = inject(CompanyService);
  private readonly slugContext = inject(CompanySlugContext);

  /** La empresa la resuelve la URL (slug), igual que en el login - sin ella el
   * backend no puede saber a cual cuenta restablecer si el correo se repite entre
   * empresas (apunta solo a la credencial sin empresa, SuperAdmin). */
  slug: string | null = this.slugContext.slug();

  brandLoaded = false;
  brandNotFound = false;
  companyName = DEFAULT_COMPANY_NAME;
  logoUrl: string | null = null;
  colorPrimario = DEFAULT_BRAND_COLOR;

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  forgotForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), noLeadingTrailingSpaceValidator(), Validators.maxLength(255)]]
  });

  get email() { return this.forgotForm.get('email'); }

  ngOnInit() {
    if (this.slug) {
      this.companyService.getBrandingBySlug(this.slug).subscribe({
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
    } else {
      this.logoUrl = DEFAULT_LOGO_URL;
      this.brandLoaded = true;
    }
  }

  submit() {
    const rawEmail = this.forgotForm.getRawValue().email ?? '';
    if (rawEmail !== rawEmail.trim()) {
      this.errorMessage = 'El correo no debe contener espacios al inicio o al final.';
      return;
    }

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const emailValue = this.forgotForm.value.email!;

    this.authService.forgotPassword(emailValue, this.slug).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.successMessage = res.message || 'Se han enviado las instrucciones a tu correo.';
        this.forgotForm.reset();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Ocurrió un error al procesar la solicitud.';
      }
    });
  }
}
