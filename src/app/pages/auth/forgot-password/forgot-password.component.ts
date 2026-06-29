import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  forgotForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.pattern(/^\S+@\S+\.\S+$/), Validators.maxLength(255)]]
  });

  get email() { return this.forgotForm.get('email'); }

  submit() {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const emailValue = this.forgotForm.value.email!;

    this.authService.forgotPassword(emailValue).subscribe({
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
