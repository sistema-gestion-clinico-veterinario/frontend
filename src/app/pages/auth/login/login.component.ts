import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { Router, RouterModule } from '@angular/router';
import { finalize, from, switchMap, timeout } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveInitialRoute } from '../../../layouts/main-layout/navbar/navbar.component';
import { SessionService } from '../../../core/services/session.service';
import { LoadingStore } from '../../../store/loading.store';

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
  private sessionService = inject(SessionService);
  private loadingStore = inject(LoadingStore);

  authError: string | null = null;
  isSubmitting = false;
  showPassword = false;

  ngOnInit() {
    this.sessionService.initialize().subscribe((authenticated) => {
      if (!authenticated) return;
      this.navigateToInitialRoute();
    });
  }

  loginForm = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email, noLeadingTrailingSpaceValidator(), Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.maxLength(72)]]
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
    const hasUntrimmedPassword = rawPassword !== rawPassword.trim();

    if (hasUntrimmedEmail || hasUntrimmedPassword) {
      if (hasUntrimmedEmail) {
        this.authError = 'El correo no debe contener espacios al inicio o al final.';
        this.loginForm.get('email')?.markAsTouched();
      } else {
        this.authError = 'La contraseña no debe iniciar ni terminar con espacios.';
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
    this.loadingStore.show();

    this.authService.login({ email: rawEmail, password: rawPassword }).pipe(
      timeout(15000),
      switchMap(({ data }) => {
        const roles = data.roles ?? [];
        if (roles.length === 0) {
          this.authStore.logout();
          throw new MissingRoleError();
        }

        this.sessionService.establish(data);
        sessionStorage.removeItem('pw_modal_dismissed');
        return from(this.router.navigateByUrl(resolveInitialRoute(data.menu ?? [], data.activeRolePurpose)));
      }),
      finalize(() => {
        this.isSubmitting = false;
        this.loadingStore.hide();
      })
    ).subscribe({
      next: () => {},
      error: (error) => {
        this.authError = this.resolveLoginError(error);
      },
    });
  }

  private resolveLoginError(error: any): string {
    if (error instanceof MissingRoleError) {
      return 'Tu usuario no tiene ningún rol asignado. Contacta al administrador.';
    }
    if (error?.name === 'TimeoutError' || error?.status === 0) {
      return 'No se pudo conectar con el servidor. Intenta nuevamente en unos segundos.';
    }

    const payload = error?.error;
    const serverMessage = typeof payload === 'string'
      ? payload
      : payload?.message || payload?.error;

    return serverMessage || 'Correo o contraseña incorrectos.';
  }

  private navigateToInitialRoute(): void {
    this.router.navigateByUrl(resolveInitialRoute(this.authStore.menu() ?? [], this.authStore.activeRolePurpose()));
  }
}

class MissingRoleError extends Error {}
