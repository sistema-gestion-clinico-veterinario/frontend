import { computed, Injectable, signal } from '@angular/core';

export type EstadoConexion = 'conectado' | 'reconectando' | 'sin-conexion' | 'restablecida';

export const MENSAJE_RECONECTANDO = 'Reconectando…';
export const MENSAJE_SIN_CONEXION = 'Sin conexión. Reintentando…';
export const MENSAJE_RESTABLECIDA = 'Conectado';
export const MENSAJE_NO_GUARDADO = 'No se guardó. Intenta de nuevo.';

export const MS_HASTA_SIN_CONEXION = 60000;
export const MS_AVISO_RESTABLECIDA = 3000;
export const MS_AVISO_NO_GUARDADO = 6000;

@Injectable({ providedIn: 'root' })
export class ConnectionStatusService {
  private readonly reintentos = signal(0);
  private readonly prolongado = signal(false);
  private readonly restablecida = signal(false);
  private readonly escrituraFallida = signal(false);
  private temporizadorProlongado: ReturnType<typeof setTimeout> | null = null;
  private temporizadorRestablecida: ReturnType<typeof setTimeout> | null = null;
  private temporizadorEscritura: ReturnType<typeof setTimeout> | null = null;

  readonly estado = computed<EstadoConexion>(() => {
    if (this.reintentos() > 0) {
      return this.prolongado() ? 'sin-conexion' : 'reconectando';
    }
    return this.restablecida() ? 'restablecida' : 'conectado';
  });

  readonly mensaje = computed<string | null>(() => {
    if (this.escrituraFallida()) {
      return MENSAJE_NO_GUARDADO;
    }
    switch (this.estado()) {
      case 'reconectando': return MENSAJE_RECONECTANDO;
      case 'sin-conexion': return MENSAJE_SIN_CONEXION;
      case 'restablecida': return MENSAJE_RESTABLECIDA;
      default: return null;
    }
  });

  reintentoIniciado(): void {
    this.reintentos.update(n => n + 1);
    if (this.reintentos() > 1) {
      return;
    }
    this.limpiar('temporizadorRestablecida');
    this.restablecida.set(false);
    this.prolongado.set(false);
    this.temporizadorProlongado = setTimeout(() => this.prolongado.set(true), MS_HASTA_SIN_CONEXION);
  }

  reintentoTerminado(recuperada: boolean): void {
    if (this.reintentos() === 0) {
      return;
    }
    this.reintentos.update(n => n - 1);
    if (this.reintentos() > 0) {
      return;
    }
    this.limpiar('temporizadorProlongado');
    this.prolongado.set(false);
    if (recuperada) {
      this.restablecida.set(true);
      this.temporizadorRestablecida = setTimeout(() => this.restablecida.set(false), MS_AVISO_RESTABLECIDA);
    }
  }

  escrituraNoGuardada(): void {
    this.limpiar('temporizadorEscritura');
    this.escrituraFallida.set(true);
    this.temporizadorEscritura = setTimeout(() => this.escrituraFallida.set(false), MS_AVISO_NO_GUARDADO);
  }

  private limpiar(nombre: 'temporizadorProlongado' | 'temporizadorRestablecida' | 'temporizadorEscritura'): void {
    if (this[nombre] !== null) {
      clearTimeout(this[nombre]!);
      this[nombre] = null;
    }
  }
}
