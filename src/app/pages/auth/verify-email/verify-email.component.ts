import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { strongPasswordValidators } from '../../../core/validators/password-policy.validator';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  token = this.route.snapshot.paramMap.get('token') ?? '';
  estado = signal<'form' | 'enviando' | 'exito' | 'error' | 'reenviando' | 'reenviado'>('form');
  errorMsg = signal('');

  passwordForm = this.fb.group({
    password: ['', strongPasswordValidators()],
    confirmPassword: ['', strongPasswordValidators()]
  }, { validators: this.passwordsMatch });

  resendForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), noLeadingTrailingSpaceValidator(), Validators.maxLength(255)]]
  });

  passwordsMatch(group: any) {
    const p = group.get('password')?.value;
    const c = group.get('confirmPassword')?.value;
    return p === c ? null : { mismatch: true };
  }

  submitPassword() {
    const rawPwd = this.passwordForm.getRawValue().password ?? '';
    if (rawPwd !== rawPwd.trim()) {
      this.passwordForm.markAllAsTouched();
      this.errorMsg.set('La contraseña no debe contener espacios.');
      return;
    }
    if (this.passwordForm.invalid || !this.token) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.estado.set('enviando');
    this.authService.setupAccount(this.token, this.passwordForm.value.password!).subscribe({
      next: () => this.estado.set('exito'),
      error: (err) => {
        this.estado.set('error');
        this.errorMsg.set(err.error?.message || 'El enlace expiró o ya fue utilizado.');
      }
    });
  }

  reenviar() {
    const rawEmail = this.resendForm.getRawValue().email ?? '';
    if (rawEmail !== rawEmail.trim()) {
      this.errorMsg.set('El correo no debe contener espacios.');
      return;
    }
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }
    this.estado.set('reenviando');
    this.authService.resendVerification(this.resendForm.value.email!).subscribe({
      next: () => this.estado.set('reenviado'),
      error: (err) => this.errorMsg.set(err.error?.message || 'Error al reenviar el correo')
    });
  }

  irAlLogin() {
    this.router.navigate(['/login']);
  }
}
