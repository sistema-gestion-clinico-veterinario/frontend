import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Injector, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { CancelacionDatosService } from '../../../core/services/cancelacion-datos.service';
import { CancelacionDatosElegibilidad } from '../../../models/privacy/cancelacion-datos.model';
import { CodigoVerificacionComponent } from '../../../shared/components/codigo-verificacion/codigo-verificacion.component';
import { AuthStore } from '../../../store/auth.store';

const ESPERA_REENVIO_SEGUNDOS = 60;

@Component({
  selector: 'app-cancelar-datos-card',
  standalone: true,
  imports: [CommonModule, CodigoVerificacionComponent],
  templateUrl: './cancelar-datos-card.component.html'
})
export class CancelarDatosCardComponent implements OnInit {
  private readonly servicio = inject(CancelacionDatosService);
  private readonly authStore = inject(AuthStore);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = computed(() => this.authStore.activeRolePurpose() === 'CLIENT_PORTAL');
  readonly estado = signal<CancelacionDatosElegibilidad | null>(null);
  readonly dialogoAbierto = signal(false);
  readonly paso = signal<'inicio' | 'codigo' | 'listo'>('inicio');
  readonly password = signal('');
  readonly motivo = signal('');
  readonly codigo = signal('');
  readonly trabajando = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly espera = signal(0);
  readonly mostrarPassword = signal(false);

  readonly pendiente = computed(() => {
    const vigente = this.estado()?.solicitudVigente;
    return vigente?.estado === 'PENDIENTE' ? vigente : null;
  });
  readonly rechazada = computed(() => {
    const vigente = this.estado()?.solicitudVigente;
    return vigente?.estado === 'RECHAZADA' ? vigente : null;
  });

  private readonly entradaCodigo = viewChild(CodigoVerificacionComponent);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.detenerContador());
  }

  ngOnInit(): void {
    if (this.visible()) this.cargar();
  }

  esperaLegible(segundos: number): string {
    return segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  }

  abrir(): void {
    this.reiniciar();
    this.dialogoAbierto.set(true);
  }

  cancelar(): void {
    if (this.trabajando()) return;
    this.dialogoAbierto.set(false);
    this.reiniciar();
  }

  alternarPassword(): void {
    this.mostrarPassword.update(visible => !visible);
  }

  enviarCodigo(): void {
    if (this.espera() > 0 || this.trabajando()) return;
    const requierePassword = this.estado()?.requierePassword === true;
    if (requierePassword && !this.password()) {
      this.error.set('Escribe tu contraseña para continuar.');
      return;
    }
    this.trabajando.set(true);
    this.error.set('');
    this.servicio.pedirCodigo(requierePassword ? this.password() : null).subscribe({
      next: ({ message, data }) => {
        this.trabajando.set(false);
        this.paso.set('codigo');
        this.codigo.set('');
        this.info.set(message || 'Te enviamos un código a tu correo.');
        this.iniciarContador(data?.retryAfterSeconds || ESPERA_REENVIO_SEGUNDOS);
        afterNextRender(() => this.entradaCodigo()?.enfocarPrimero(), { injector: this.injector });
      },
      error: (err) => {
        this.trabajando.set(false);
        const espera = Number(err.error?.data?.retryAfterSeconds);
        if (espera > 0) this.iniciarContador(espera);
        this.error.set(err.error?.message || 'No pudimos enviarte el código. Inténtalo de nuevo.');
      }
    });
  }

  confirmar(): void {
    const codigo = this.codigo().trim();
    if (!/^\d{6}$/.test(codigo)) {
      this.error.set('El código tiene 6 dígitos.');
      return;
    }
    this.trabajando.set(true);
    this.error.set('');
    this.servicio.solicitar(codigo, this.motivo().trim() || null).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.paso.set('listo');
        this.cargar();
      },
      error: (err) => {
        this.trabajando.set(false);
        this.error.set(err.error?.message || 'No pudimos registrar tu solicitud. Inténtalo de nuevo.');
      }
    });
  }

  private cargar(): void {
    this.servicio.estado().subscribe({
      next: ({ data }) => this.estado.set(data),
      error: () => this.estado.set(null)
    });
  }

  private iniciarContador(segundos: number): void {
    this.detenerContador();
    this.espera.set(segundos);
    this.temporizador = setInterval(() => {
      const restante = this.espera() - 1;
      this.espera.set(Math.max(restante, 0));
      if (restante <= 0) this.detenerContador();
    }, 1000);
  }

  private detenerContador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  private reiniciar(): void {
    this.paso.set('inicio');
    this.mostrarPassword.set(false);
    this.password.set('');
    this.motivo.set('');
    this.codigo.set('');
    this.error.set('');
    this.info.set('');
  }
}
