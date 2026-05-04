import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../store/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private authService = inject(AuthService);

  authError: string | null = null;
  isSubmitting = false;
  showPassword = false;

  loginForm = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {}

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  submit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.authError = null;
    this.isSubmitting = true;

    this.authService.login(this.loginForm.value as { email: string; password: string }).subscribe({
      next: ({ data }) => {
        this.authStore.setAuth({
          token: data.token,
          roles: data.roles,
          permissions: data.permissions,
          companyId: data.companyId,
          companyName: data.companyName,
          nombreCompleto: data.nombreCompleto,
          userType: data.userType,
          passwordChanged: data.passwordChanged,
          needsCompanySelection: data.needsCompanySelection,
          selectedEnterprise: null
        });

        this.router.navigateByUrl(this.getInitialRoute(data.roles));
      },
      error: () => {
        this.authError = 'Error al iniciar sesión. Verifica tus credenciales o intenta de nuevo más tarde.';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  private getInitialRoute(roles: string[]): string {
    if (roles.includes('ROLE_ADMIN') || roles.includes('ROLE_VETERINARIO')) {
      return '/dashboard';
    }
    return '/dashboard';
  }
}