import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type Estado = 'cargando' | 'exito' | 'error' | 'reenviando' | 'reenviado';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly fb         = inject(FormBuilder);

  estado        = signal<Estado>('cargando');
  errorMsg      = signal<string>('');
  resendLoading = signal<boolean>(false);
  resendError   = signal<string>('');

  resendForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.estado.set('error');
      this.errorMsg.set('El enlace de verificación no es válido.');
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => this.estado.set('exito'),
      error: (err) => {
        this.estado.set('error');
        this.errorMsg.set(
          err.error?.message || 'El enlace expiró o ya fue utilizado.'
        );
      }
    });
  }

  irAlLogin() {
    this.router.navigate(['/login']);
  }

  reenviar() {
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }

    const email = this.resendForm.value.email!;
    this.resendLoading.set(true);
    this.resendError.set('');

    this.authService.resendVerification(email).subscribe({
      next: () => {
        this.resendLoading.set(false);
        this.estado.set('reenviado');
      },
      error: (err) => {
        this.resendLoading.set(false);
        this.resendError.set(err.error?.message || 'No se pudo reenviar el correo. Verifica el email ingresado.');
      }
    });
  }
}
