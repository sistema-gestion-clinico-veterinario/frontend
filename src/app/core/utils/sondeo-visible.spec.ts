import { fakeAsync, tick } from '@angular/core/testing';
import { sondeoVisible } from './sondeo-visible';

class DocumentoFalso extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';

  cambiarA(estado: DocumentVisibilityState): void {
    this.visibilityState = estado;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('sondeoVisible', () => {
  const PERIODO = 1000;
  let documento: DocumentoFalso;

  const comoDocumento = () => documento as unknown as Document;

  beforeEach(() => {
    documento = new DocumentoFalso();
  });

  it('con la pestaña visible emite una vez por periodo', fakeAsync(() => {
    let emisiones = 0;
    const suscripcion = sondeoVisible(PERIODO, { documento: comoDocumento() }).subscribe(() => emisiones++);

    tick(PERIODO * 3);

    expect(emisiones).toBe(3);
    suscripcion.unsubscribe();
  }));

  it('con la pestaña oculta no emite aunque pasen varios periodos', fakeAsync(() => {
    let emisiones = 0;
    const suscripcion = sondeoVisible(PERIODO, { documento: comoDocumento() }).subscribe(() => emisiones++);
    documento.cambiarA('hidden');

    tick(PERIODO * 10);

    expect(emisiones).toBe(0);
    suscripcion.unsubscribe();
  }));

  it('al volver a ser visible tras perder un turno actualiza una sola vez y retoma el periodo', fakeAsync(() => {
    let emisiones = 0;
    const suscripcion = sondeoVisible(PERIODO, { documento: comoDocumento() }).subscribe(() => emisiones++);
    documento.cambiarA('hidden');
    tick(PERIODO * 5);

    documento.cambiarA('visible');

    expect(emisiones).toBe(1);
    tick(PERIODO - 1);
    expect(emisiones).toBe(1);
    tick(1);
    expect(emisiones).toBe(2);
    suscripcion.unsubscribe();
  }));

  it('si vuelve antes de perder un turno no añade ninguna actualización', fakeAsync(() => {
    let emisiones = 0;
    const suscripcion = sondeoVisible(PERIODO, { documento: comoDocumento() }).subscribe(() => emisiones++);
    documento.cambiarA('hidden');
    tick(PERIODO / 2);

    documento.cambiarA('visible');

    expect(emisiones).toBe(0);
    tick(PERIODO / 2);
    expect(emisiones).toBe(1);
    suscripcion.unsubscribe();
  }));

  it('con la opción inmediato emite al suscribirse', fakeAsync(() => {
    let emisiones = 0;
    const suscripcion = sondeoVisible(PERIODO, { documento: comoDocumento(), inmediato: true }).subscribe(() => emisiones++);

    expect(emisiones).toBe(1);
    tick(PERIODO);
    expect(emisiones).toBe(2);
    suscripcion.unsubscribe();
  }));

  it('sin documento funciona como un temporizador normal', fakeAsync(() => {
    let emisiones = 0;
    const suscripcion = sondeoVisible(PERIODO, { documento: null }).subscribe(() => emisiones++);

    tick(PERIODO * 2);

    expect(emisiones).toBe(2);
    suscripcion.unsubscribe();
  }));

  it('al cancelar la suscripción deja de emitir y retira el aviso de visibilidad', fakeAsync(() => {
    let emisiones = 0;
    const retirar = spyOn(documento, 'removeEventListener').and.callThrough();
    const suscripcion = sondeoVisible(PERIODO, { documento: comoDocumento() }).subscribe(() => emisiones++);

    suscripcion.unsubscribe();
    tick(PERIODO * 3);
    documento.cambiarA('hidden');
    documento.cambiarA('visible');

    expect(emisiones).toBe(0);
    expect(retirar).toHaveBeenCalledWith('visibilitychange', jasmine.any(Function));
  }));
});
