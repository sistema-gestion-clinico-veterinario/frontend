import { Component, ElementRef, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, signal, viewChildren } from '@angular/core';
import { AccountClosureEligibility, AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { AuthStore } from '../../../store/auth.store';

const LONGITUD_CODIGO = 6;
const ESPERA_REENVIO_SEGUNDOS = 60;

@Component({
  selector: 'app-close-account-card',
  standalone: true,
  templateUrl: './close-account-card.component.html'
})
export class CloseAccountCardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly sessionService = inject(SessionService);
  private readonly authStore = inject(AuthStore);
  private readonly injector = inject(Injector);

  readonly eligibility = signal<AccountClosureEligibility | null>(null);
  readonly dialogOpen = signal(false);
  readonly step = signal<'request' | 'code'>('request');
  readonly password = signal('');
  readonly code = signal('');
  readonly working = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly cooldown = signal(0);
  readonly showPassword = signal(false);
  readonly casillas = Array.from({ length: LONGITUD_CODIGO }, (_, i) => i);
  readonly digitos = computed(() => this.casillas.map(i => {
    const caracter = this.code()[i];
    return caracter && caracter !== ' ' ? caracter : '';
  }));

  private readonly campos = viewChildren<ElementRef<HTMLInputElement>>('casilla');
  private temporizador: ReturnType<typeof setInterval> | null = null;

  readonly visible = computed(() => this.authStore.activeRolePurpose() !== 'PLATFORM_ADMIN');
  readonly isClient = computed(() => this.authStore.activeRolePurpose() === 'CLIENT_PORTAL');

  ngOnInit(): void {
    if (!this.visible()) return;
    this.authService.getAccountClosureEligibility().subscribe({
      next: ({ data }) => this.eligibility.set(data),
      error: () => this.eligibility.set(null)
    });
  }

  ngOnDestroy(): void {
    this.detenerContador();
  }

  esperaLegible(segundos: number): string {
    if (segundos < 60) return `${segundos} s`;
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  }

  togglePassword(): void {
    this.showPassword.update(visible => !visible);
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
    if (this.cooldown() > 0) return;
    const needsPassword = this.eligibility()?.requiresPassword === true;
    if (needsPassword && !this.password()) {
      this.error.set('Escribe tu contraseña para continuar.');
      return;
    }
    this.working.set(true);
    this.error.set('');
    this.authService.requestAccountClosure(needsPassword ? this.password() : null).subscribe({
      next: ({ message, data }) => {
        this.working.set(false);
        this.step.set('code');
        this.code.set('');
        this.info.set(message || 'Te enviamos un código a tu correo.');
        this.iniciarContador(data?.retryAfterSeconds || ESPERA_REENVIO_SEGUNDOS);
        afterNextRender(() => this.enfocar(0), { injector: this.injector });
      },
      error: (err) => {
        this.working.set(false);
        const espera = Number(err.error?.data?.retryAfterSeconds);
        if (espera > 0) this.iniciarContador(espera);
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
        this.sessionService.closeLocalSession(undefined, '/cuenta-cerrada');
      },
      error: (err) => {
        this.working.set(false);
        this.error.set(err.error?.message || 'No pudimos cerrar tu cuenta. Inténtalo de nuevo.');
      }
    });
  }

  alEscribir(indice: number, evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const soloDigitos = campo.value.replace(/\D/g, '');
    if (!soloDigitos) {
      this.poner(indice, '');
      campo.value = '';
      return;
    }
    const tecleado = (evento as InputEvent).inputType === 'insertText';
    if (soloDigitos.length > 1 && !tecleado) {
      this.rellenar(indice, soloDigitos);
      return;
    }
    const digito = soloDigitos.slice(-1);
    this.poner(indice, digito);
    campo.value = digito;
    this.enfocar(indice + 1);
  }

  alPresionar(indice: number, evento: KeyboardEvent): void {
    if (evento.key === 'Backspace' && !this.digitos()[indice] && indice > 0) {
      evento.preventDefault();
      this.poner(indice - 1, '');
      this.enfocar(indice - 1);
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      this.enfocar(indice - 1);
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      this.enfocar(indice + 1);
    } else if (evento.key === 'Enter') {
      this.confirm();
    }
  }

  alPegar(indice: number, evento: ClipboardEvent): void {
    evento.preventDefault();
    this.rellenar(indice, (evento.clipboardData?.getData('text') ?? '').replace(/\D/g, ''));
  }

  private poner(indice: number, digito: string): void {
    const actuales = this.digitos().slice();
    actuales[indice] = digito;
    this.code.set(actuales.map(d => d || ' ').join('').trimEnd());
  }

  private rellenar(desde: number, digitos: string): void {
    const nuevos = digitos.slice(0, LONGITUD_CODIGO - desde);
    if (!nuevos) return;
    const actuales = this.digitos().slice();
    [...nuevos].forEach((d, k) => (actuales[desde + k] = d));
    this.code.set(actuales.map(d => d || ' ').join('').trimEnd());
    this.enfocar(Math.min(desde + nuevos.length, LONGITUD_CODIGO - 1));
  }

  private enfocar(indice: number): void {
    const campo = this.campos()[indice]?.nativeElement;
    if (campo) {
      campo.focus();
      campo.select();
    }
  }

  private iniciarContador(segundos: number): void {
    this.detenerContador();
    this.cooldown.set(segundos);
    this.temporizador = setInterval(() => {
      const restante = this.cooldown() - 1;
      this.cooldown.set(Math.max(restante, 0));
      if (restante <= 0) this.detenerContador();
    }, 1000);
  }

  private detenerContador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  private reset(): void {
    this.step.set('request');
    this.showPassword.set(false);
    this.password.set('');
    this.code.set('');
    this.error.set('');
    this.info.set('');
  }
}
