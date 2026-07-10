import { Component, EventEmitter, Output, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { UsuarioService } from '../../../../core/services/usuario.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { strongPasswordValidators } from '../../../../core/validators/password-policy.validator';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToastModule],
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
  providers: [MessageService]
})
export class ChangePasswordModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly usuarioService = inject(UsuarioService);
  private readonly messageService = inject(MessageService);

  userId = input.required<number>();
  userName = input.required<string>();
  
  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  loading = signal(false);
  showPassword = signal(false);

  passwordForm = this.fb.group({
    newPassword: ['', strongPasswordValidators()],
    confirmPassword: ['', strongPasswordValidators()]
  }, {
    validators: this.passwordMatchValidator
  });

  passwordMatchValidator(g: any) {
    return g.get('newPassword').value === g.get('confirmPassword').value
      ? null : { mismatch: true };
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  onSubmit() {
    const rawPwd = this.passwordForm.getRawValue().newPassword ?? '';
    if (rawPwd !== rawPwd.trim()) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'La contraseña no debe contener espacios.' });
      return;
    }
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const newPassword = this.passwordForm.get('newPassword')?.value;

    this.usuarioService.resetPassword(this.userId(), newPassword!).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Contraseña actualizada y notificada por correo'
        });
        setTimeout(() => {
          this.loading.set(false);
          this.onConfirm.emit();
        }, 1500);
      },
      error: (err) => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'No se pudo actualizar la contraseña'
        });
      }
    });
  }

  close() {
    this.onClose.emit();
  }
}
