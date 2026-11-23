import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import {
  ConnectionStatusService, MENSAJE_NO_GUARDADO, MENSAJE_RECONECTANDO, MENSAJE_RESTABLECIDA, MENSAJE_SIN_CONEXION,
  MS_AVISO_NO_GUARDADO, MS_AVISO_RESTABLECIDA, MS_HASTA_SIN_CONEXION
} from './connection-status.service';

describe('ConnectionStatusService', () => {
  let servicio: ConnectionStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(ConnectionStatusService);
  });

  it('sin reintentos no muestra ningún aviso', () => {
    expect(servicio.estado()).toBe('conectado');
    expect(servicio.mensaje()).toBeNull();
  });

  it('un reintento en curso muestra «Reconectando…»', fakeAsync(() => {
    servicio.reintentoIniciado();

    expect(servicio.estado()).toBe('reconectando');
    expect(servicio.mensaje()).toBe(MENSAJE_RECONECTANDO);
    servicio.reintentoTerminado(false);
  }));

  it('pasa a «Sin conexión» tras 60 s de reintentos y vuelve a «Reconectando…» con uno nuevo', fakeAsync(() => {
    servicio.reintentoIniciado();
    tick(MS_HASTA_SIN_CONEXION - 1);
    expect(servicio.mensaje()).toBe(MENSAJE_RECONECTANDO);

    tick(1);
    expect(servicio.estado()).toBe('sin-conexion');
    expect(servicio.mensaje()).toBe(MENSAJE_SIN_CONEXION);

    servicio.reintentoTerminado(false);
    servicio.reintentoIniciado();
    expect(servicio.mensaje()).toBe(MENSAJE_RECONECTANDO);
    servicio.reintentoTerminado(false);
  }));

  it('varios reintentos a la vez comparten el aviso y no lo cierran hasta que termina el último', fakeAsync(() => {
    servicio.reintentoIniciado();
    servicio.reintentoIniciado();
    servicio.reintentoTerminado(true);

    expect(servicio.estado()).toBe('reconectando');

    servicio.reintentoTerminado(true);
    expect(servicio.estado()).toBe('restablecida');
    tick(MS_AVISO_RESTABLECIDA);
  }));

  it('al recuperarse muestra «Conectado» 3 s y después desaparece', fakeAsync(() => {
    servicio.reintentoIniciado();
    servicio.reintentoTerminado(true);

    expect(servicio.mensaje()).toBe(MENSAJE_RESTABLECIDA);
    tick(MS_AVISO_RESTABLECIDA);
    expect(servicio.mensaje()).toBeNull();
  }));

  it('si el reintento termina sin recuperarse, el aviso se quita sin decir «Conectado»', fakeAsync(() => {
    servicio.reintentoIniciado();
    servicio.reintentoTerminado(false);

    expect(servicio.estado()).toBe('conectado');
    expect(servicio.mensaje()).toBeNull();
  }));

  it('un guardado fallido muestra «No se guardó» 6 s y tiene prioridad sobre el resto', fakeAsync(() => {
    servicio.reintentoIniciado();
    servicio.escrituraNoGuardada();

    expect(servicio.mensaje()).toBe(MENSAJE_NO_GUARDADO);
    tick(MS_AVISO_NO_GUARDADO);
    expect(servicio.mensaje()).toBe(MENSAJE_RECONECTANDO);
    servicio.reintentoTerminado(false);
  }));

  it('terminar un reintento que nunca empezó no deja el contador en negativo', fakeAsync(() => {
    servicio.reintentoTerminado(true);
    servicio.reintentoIniciado();

    expect(servicio.estado()).toBe('reconectando');
    servicio.reintentoTerminado(false);
  }));
});
