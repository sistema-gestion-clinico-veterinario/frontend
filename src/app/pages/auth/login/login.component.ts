import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { Router, RouterModule } from '@angular/router';
import { catchError, EMPTY, finalize, timeout } from 'rxjs';
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
    if (this.authStore.roles().length > 0) {
      this.authService.refreshToken().pipe(
        timeout(10000),
        catchError(() => {
          this.authStore.logout();
          return EMPTY;
        })
      ).subscribe(({ data }) => {
        this.authStore.setAuth({
          token: null,
          refreshToken: null,
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
        const roles = data.roles ?? [];
        this.router.navigateByUrl(resolveInitialRoute(roles, data.menu ?? []));
      });
    }
  }

  loginForm = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), noLeadingTrailingSpaceValidator(), Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72), Validators.pattern(/^(?!.*\.\.\.)(?!.*\s).+$/)]]
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
    const rawEmail = (document.getElementById('email') as HTMLInputElement)?.value ?? '';
    const rawPassword = (document.getElementById('password') as HTMLInputElement)?.value ?? '';
    this.loginForm.get('email')?.setValue(rawEmail, { emitEvent: false });
    this.loginForm.get('password')?.setValue(rawPassword, { emitEvent: false });

    const hasUntrimmedEmail = rawEmail !== rawEmail.trim();
    const hasSpacesPassword = /\s/.test(rawPassword);
    const hasEllipsisPassword = /\.\.\./.test(rawPassword);

    if (hasUntrimmedEmail || hasSpacesPassword || hasEllipsisPassword) {
      if (hasUntrimmedEmail) {
        this.authError = 'El correo no debe contener espacios al inicio o al final.';
        this.loginForm.get('email')?.markAsTouched();
      } else if (hasEllipsisPassword) {
        this.authError = 'La contraseña no debe contener "...".';
        this.loginForm.get('password')?.markAsTouched();
      } else {
        this.authError = 'La contraseña no debe contener espacios.';
        this.loginForm.get('password')?.markAsTouched();
      }
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.authError = null;
    this.isSubmitting = true;

    this.authService.login({ email: rawEmail, password: rawPassword }).pipe(
      timeout(15000),
      finalize(() => this.isSubmitting = false)
    ).subscribe({
      next: ({ data }) => {
        this.authStore.setAuth({
          token: null,
          refreshToken: null,
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
        this.authError = this.resolveLoginError(error);
      },
    });
  }

  private resolveLoginError(error: any): string {
    if (error?.name === 'TimeoutError' || error?.status === 0) {
      return 'No se pudo conectar con el servidor. Intenta nuevamente en unos segundos.';
    }

    const payload = error?.error;
    const serverMessage = typeof payload === 'string'
      ? payload
      : payload?.message || payload?.error;

    return serverMessage || 'Correo o contraseña incorrectos.';
  }
}
