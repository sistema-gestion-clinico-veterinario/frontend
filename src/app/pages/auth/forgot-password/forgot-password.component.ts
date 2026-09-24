import { Component, inject } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly slugContext = inject(CompanySlugContext);

  /** La empresa la resuelve la URL (slug), igual que en el login - sin ella el
   * backend no puede saber a cual cuenta restablecer si el correo se repite entre
   * empresas (apunta solo a la credencial sin empresa, SuperAdmin). */
  slug: string | null = this.slugContext.slug();

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  forgotForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), noLeadingTrailingSpaceValidator(), Validators.maxLength(255)]]
  });

  get email() { return this.forgotForm.get('email'); }

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
