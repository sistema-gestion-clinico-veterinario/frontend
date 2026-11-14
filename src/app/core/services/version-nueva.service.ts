import { Injectable, signal } from '@angular/core';

const MENSAJES_DE_CARGA = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /loading chunk \S+ failed/i
];

export function esErrorDeCargaDeFragmento(error: unknown, profundidad = 0): boolean {
  if (!error || profundidad > 3) return false;
  if (typeof error === 'string') return MENSAJES_DE_CARGA.some(patron => patron.test(error));
  if (typeof error !== 'object') return false;

  const candidato = error as { name?: unknown; message?: unknown; rejection?: unknown; cause?: unknown; originalError?: unknown };
  if (candidato.name === 'ChunkLoadError') return true;
  if (typeof candidato.message === 'string' && esErrorDeCargaDeFragmento(candidato.message, profundidad + 1)) return true;
  return [candidato.rejection, candidato.cause, candidato.originalError]
    .some(interno => esErrorDeCargaDeFragmento(interno, profundidad + 1));
}

@Injectable({ providedIn: 'root' })
export class VersionNuevaService {
  private readonly estado = signal(false);
  readonly disponible = this.estado.asReadonly();

  registrarError(error: unknown): boolean {
    if (!esErrorDeCargaDeFragmento(error)) return false;
    this.estado.set(true);
    return true;
  }

  recargar(): void {
    window.location.reload();
  }
}
