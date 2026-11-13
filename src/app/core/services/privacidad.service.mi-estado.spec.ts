import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CamposAvisoPrivacidad } from '../../models/privacy/privacidad.model';
import { AuthStore } from '../../store/auth.store';
import { PrivacidadService } from './privacidad.service';

describe('PrivacidadService (mi estado)', () => {
  let http: HttpTestingController;
  let servicio: PrivacidadService;
  let companyId: number | null;
  let activeRoleId: number | null;
  let nombre: string;
  let establecimiento: number | null;

  const estado = { success: true, message: 'ok', data: { avisoPublicado: true, vistaPorLaPersona: false, finalidades: [] } };
  const ok = { success: true, message: 'ok', data: {} };
  const esMiEstado = (candidate: { url: string }) => candidate.url.endsWith('/privacidad/mi-estado');

  beforeEach(() => {
    companyId = 8;
    activeRoleId = 3;
    nombre = 'Ana Pruebas';
    establecimiento = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthStore,
          useValue: {
            companyId: () => companyId,
            activeRoleId: () => activeRoleId,
            nombreCompleto: () => nombre,
            selectedEnterprise: () => establecimiento == null ? null : { establishmentId: establecimiento }
          }
        }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(PrivacidadService);
  });

  afterEach(() => expect(() => http.verify()).not.toThrow());

  it('la guarda del aviso y el servicio de pendientes comparten una sola llamada', () => {
    const recibidos: unknown[] = [];
    servicio.miEstado().subscribe(respuesta => recibidos.push(respuesta));
    servicio.miEstado().subscribe(respuesta => recibidos.push(respuesta));

    http.expectOne(esMiEstado).flush(estado);

    expect(recibidos.length).toBe(2);
    expect(recibidos[1]).toBe(recibidos[0]);
  });

  it('una consulta posterior dentro de la ventana recibe la respuesta guardada', () => {
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    let recibido: unknown;
    servicio.miEstado().subscribe(respuesta => recibido = respuesta);

    http.expectNone(esMiEstado);
    expect(recibido).toEqual(estado);
  });

  it('no mezcla personas, clínicas ni roles', () => {
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    nombre = 'Luis Otro';
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    companyId = 9;
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    activeRoleId = 4;
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);
  });

  it('con la clínica elegida por un administrador de plataforma usa esa clínica como clave', () => {
    companyId = null;
    establecimiento = 21;
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    establecimiento = 22;
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);
  });

  it('vuelve a pedir el estado pasados 15 segundos', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 10, 13, 10, 0, 0));
      servicio.miEstado().subscribe();
      http.expectOne(esMiEstado).flush(estado);

      jasmine.clock().mockDate(new Date(2026, 10, 13, 10, 0, 14));
      servicio.miEstado().subscribe();
      http.expectNone(esMiEstado);

      jasmine.clock().mockDate(new Date(2026, 10, 13, 10, 0, 16));
      servicio.miEstado().subscribe();
      http.expectOne(esMiEstado).flush(estado);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('una llamada que falla no queda guardada', () => {
    servicio.miEstado().subscribe({ error: () => undefined });
    http.expectOne(esMiEstado).flush('error', { status: 500, statusText: 'Server Error' });

    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);
  });

  it('confirmar la lectura del aviso invalida el estado guardado', () => {
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    servicio.leiElAviso().subscribe();
    http.expectOne(candidate => candidate.method === 'POST' && candidate.url.endsWith('/privacidad/enterado')).flush(ok);

    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);
  });

  it('decidir una finalidad invalida el estado guardado', () => {
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    servicio.decidir('USO_IA', true).subscribe();
    http.expectOne(candidate => candidate.method === 'PUT' && candidate.url.endsWith('/privacidad/finalidades/USO_IA')).flush(ok);

    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);
  });

  it('publicar un aviso nuevo invalida el estado guardado', () => {
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    servicio.publicar({ razonSocial: 'Clínica Patitas S.A.C.' } as CamposAvisoPrivacidad, true).subscribe();
    http.expectOne(candidate => candidate.method === 'POST' && candidate.url.endsWith('/admin/privacidad/aviso')).flush(ok);

    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);
  });

  it('una operación rechazada por el servidor no invalida el estado guardado', () => {
    servicio.miEstado().subscribe();
    http.expectOne(esMiEstado).flush(estado);

    servicio.leiElAviso().subscribe({ error: () => undefined });
    http.expectOne(candidate => candidate.method === 'POST' && candidate.url.endsWith('/privacidad/enterado'))
      .flush('error', { status: 400, statusText: 'Bad Request' });

    servicio.miEstado().subscribe();
    http.expectNone(esMiEstado);
  });
});
