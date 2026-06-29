import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveInitialRoute } from '../../../layouts/main-layout/navbar/navbar.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private authService = inject(AuthService);

  authError: string | null = null;
  isSubmitting = false;
  showPassword = false;

  ngOnInit() {
    if (this.authStore.token()) {
      const roles = this.authStore.roles() ?? [];
      this.router.navigateByUrl(resolveInitialRoute(roles, this.authStore.menu() ?? []));
    }
  }

  loginForm = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.pattern(/^\S+@\S+\.\S+$/), Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72), Validators.pattern(/^\S+$/)]]
  });

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  submit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.authError = null;
    this.isSubmitting = true;

    this.authService.login(this.loginForm.value as { email: string; password: string }).pipe(
      timeout(15000),
      finalize(() => this.isSubmitting = false)
    ).subscribe({
      next: ({ data }) => {
        this.authStore.setAuth({
          token: data.token,
          refreshToken: data.refreshToken,
          roles: data.roles,
          companyId: data.companyId,
          companyName: data.companyName,
          nombreCompleto: data.nombreCompleto,
          userType: data.userType,
          empleadoId: data.empleadoId ?? null,
          passwordChanged: data.passwordChanged,
          needsCompanySelection: data.needsCompanySelection,
          selectedEnterprise: null,
          menu: data.menu,
          assignedRoles: data.assignedRoles ?? data.roles
        });
        sessionStorage.removeItem('pw_modal_dismissed');
        const roles = data.roles ?? [];
        if (roles.length === 0) {
          this.authStore.logout();
          this.authError = 'Tu usuario no tiene ningún rol asignado. Contacta al administrador.';
          return;
        }
        this.router.navigateByUrl(resolveInitialRoute(roles, data.menu ?? []));
      },
      error: (error) => {
        this.authError = error?.name === 'TimeoutError' || error?.status === 0
          ? 'No se pudo conectar con el servidor. Intenta nuevamente en unos segundos.'
          : 'Correo o contraseña incorrectos.';
      },
    });
  }
}
