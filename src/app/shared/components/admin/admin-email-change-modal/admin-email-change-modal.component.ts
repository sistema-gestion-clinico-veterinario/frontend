import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { lowercaseEmailValidator } from '../../../../core/validators/lowercase-email.validator';

@Component({
  selector: 'app-admin-email-change-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-email-change-modal.component.html'
})
export class AdminEmailChangeModalComponent {
  @Input({ required: true }) userId!: number;
  @Input() displayName = '';
  @Input() currentEmail = '';
  @Input() pending = false;
  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<string>();

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  submitting = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), Validators.maxLength(254)]],
    confirmEmail: ['', [Validators.required]],
    motivo: ['', [Validators.maxLength(300)]]
  }, { validators: (group: AbstractControl): ValidationErrors | null =>
    group.get('newEmail')?.value === group.get('confirmEmail')?.value ? null : { emailMismatch: true } });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { newEmail, motivo } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMsg.set(null);
    this.authService.adminChangeEmail(this.userId, newEmail.trim(), motivo.trim()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.sent.emit(response.message);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.message || 'No se pudo solicitar el cambio. Inténtalo nuevamente.');
      }
    });
  }
}
