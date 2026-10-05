import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AccountClosureEligibility, AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { AuthStore } from '../../../store/auth.store';

@Component({
  selector: 'app-close-account-card',
  standalone: true,
  templateUrl: './close-account-card.component.html'
})
export class CloseAccountCardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly sessionService = inject(SessionService);
  private readonly authStore = inject(AuthStore);

  readonly eligibility = signal<AccountClosureEligibility | null>(null);
  readonly dialogOpen = signal(false);
  readonly step = signal<'request' | 'code'>('request');
  readonly password = signal('');
  readonly code = signal('');
  readonly working = signal(false);
  readonly error = signal('');
  readonly info = signal('');

  readonly visible = computed(() => this.authStore.activeRolePurpose() !== 'PLATFORM_ADMIN');
  readonly isClient = computed(() => this.authStore.activeRolePurpose() === 'CLIENT_PORTAL');

  ngOnInit(): void {
    if (!this.visible()) return;
    this.authService.getAccountClosureEligibility().subscribe({
      next: ({ data }) => this.eligibility.set(data),
      error: () => this.eligibility.set(null)
    });
  }

  open(): void {
    this.reset();
    this.dialogOpen.set(true);
  }

  cancel(): void {
    if (this.working()) return;
    this.dialogOpen.set(false);
    this.reset();
  }

  sendCode(): void {
    const needsPassword = this.eligibility()?.requiresPassword === true;
    if (needsPassword && !this.password()) {
      this.error.set('Escribe tu contraseña para continuar.');
      return;
    }
    this.working.set(true);
    this.error.set('');
    this.authService.requestAccountClosure(needsPassword ? this.password() : null).subscribe({
      next: ({ message }) => {
        this.working.set(false);
        this.step.set('code');
        this.code.set('');
        this.info.set(message || 'Te enviamos un código a tu correo.');
      },
      error: (err) => {
        this.working.set(false);
        this.error.set(err.error?.message || 'No pudimos enviarte el código. Inténtalo de nuevo.');
      }
    });
  }

  confirm(): void {
    const code = this.code().trim();
    if (!/^\d{6}$/.test(code)) {
      this.error.set('El código tiene 6 dígitos.');
      return;
    }
    this.working.set(true);
    this.error.set('');
    this.authService.confirmAccountClosure(code).subscribe({
      next: () => {
        this.working.set(false);
        this.dialogOpen.set(false);
        this.sessionService.closeLocalSession('cuenta_cerrada');
      },
      error: (err) => {
        this.working.set(false);
        this.error.set(err.error?.message || 'No pudimos cerrar tu cuenta. Inténtalo de nuevo.');
      }
    });
  }

  private reset(): void {
    this.step.set('request');
    this.password.set('');
    this.code.set('');
    this.error.set('');
    this.info.set('');
  }
}
