import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { strongPasswordValidators } from '../../../core/validators/password-policy.validator';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
