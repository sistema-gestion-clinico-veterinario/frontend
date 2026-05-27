import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthStore } from '../../../store/auth.store';
import { AuthService } from '../../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss'
})
export class ChangePasswordModalComponent {
  @Output() dismissed = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);

  showOld = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);
  isSubmitting = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.group({
    oldPassword: ['', [Validators.required, Validators.maxLength(72)]],
    newPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72), Validators.pattern(/^\S+$/)]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordMatchValidator });

  get passwordStrength(): number {
    const val: string = this.form.get('newPassword')?.value ?? '';
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) || /[0-9]/.test(val)) score++;
    if (/[^a-zA-Z0-9]/.test(val)) score++;
    return score;
  }

  strengthClass(index: number): string {
    const s = this.passwordStrength;
    if (index >= s) return 'bg-slate-100';
    if (s <= 1) return 'bg-rose-400';
    if (s === 2) return 'bg-amber-400';
    if (s === 3) return 'bg-blue-400';
    return 'bg-emerald-400';
  }

  strengthLabel(): string {
    const s = this.passwordStrength;
    if (s === 0) return 'Muy débil';
    if (s === 1) return 'Débil';
    if (s === 2) return 'Aceptable';
    if (s === 3) return 'Fuerte';
    return 'Excelente';
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.isSubmitting.set(true);
    this.errorMsg.set(null);
    const { oldPassword, newPassword } = this.form.value;
    this.authService.changePassword({ oldPassword: oldPassword!, newPassword: newPassword! }).subscribe({
      next: () => {
        this.authStore.setAuth({
          token: this.authStore.token()!,
          refreshToken: this.authStore.refreshToken(),
          roles: this.authStore.roles(),
          companyId: this.authStore.companyId(),
          companyName: this.authStore.companyName(),
          nombreCompleto: this.authStore.nombreCompleto(),
          userType: this.authStore.userType(),
          empleadoId: this.authStore.empleadoId(),
          passwordChanged: true,
          needsCompanySelection: this.authStore.needsCompanySelection(),
          selectedEnterprise: this.authStore.selectedEnterprise(),
          menu: this.authStore.menu(),
          assignedRoles: this.authStore.assignedRoles()
        });
        this.isSubmitting.set(false);
        this.dismissed.emit();
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message ?? 'La contraseña actual es incorrecta.');
        this.isSubmitting.set(false);
      }
    });
  }
}
