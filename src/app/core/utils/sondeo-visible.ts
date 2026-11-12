import { Observable } from 'rxjs';

export interface OpcionesSondeoVisible {
  inmediato?: boolean;
  documento?: Document | null;
}

export function sondeoVisible(periodoMs: number, opciones: OpcionesSondeoVisible = {}): Observable<void> {
  return new Observable<void>(suscriptor => {
    const documento = opciones.documento === undefined
      ? (typeof document === 'undefined' ? null : document)
      : opciones.documento;
    const estaVisible = () => !documento || documento.visibilityState !== 'hidden';
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let turnoPerdido = false;

    const programar = () => {
      if (suscriptor.closed) return;
      temporizador = setTimeout(() => {
        temporizador = null;
        if (estaVisible()) {
          suscriptor.next();
          programar();
        } else {
          turnoPerdido = true;
        }
      }, periodoMs);
    };

    const alCambiarVisibilidad = () => {
      if (turnoPerdido && estaVisible()) {
        turnoPerdido = false;
        suscriptor.next();
        programar();
      }
    };

    documento?.addEventListener('visibilitychange', alCambiarVisibilidad);
    if (opciones.inmediato) suscriptor.next();
    programar();

    return () => {
      if (temporizador !== null) clearTimeout(temporizador);
      documento?.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  });
}
