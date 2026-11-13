import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '../../store/auth.store';
import { CompanyComplianceService } from './company-compliance.service';

describe('CompanyComplianceService (mi clínica)', () => {
  let http: HttpTestingController;
  let servicio: CompanyComplianceService;
  let companyId: number | null;
  let activeRoleId: number | null;
  let establecimiento: number | null;

  const estados = { success: true, message: 'ok', data: [{ control: 'USO_IA', habilitado: true }] };
  const solicitud = {
    control: 'USO_IA' as const, habilitado: false, modo: 'CLINICA' as never, bloqueante: false,
    motivo: 'prueba', evidenciaReferencia: null, vigenteDesde: null
  };

  const esDeMiClinica = (candidate: { url: string }) => candidate.url.endsWith('/me/compliance');

  beforeEach(() => {
    companyId = 8;
    activeRoleId = 3;
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
            selectedEnterprise: () => establecimiento == null ? null : { establishmentId: establecimiento }
          }
        }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(CompanyComplianceService);
  });

  afterEach(() => expect(() => http.verify()).not.toThrow());

  it('el cascarón y las páginas comparten una sola llamada a /me/compliance', () => {
    const recibidos: unknown[] = [];
    for (let componente = 0; componente < 3; componente++) {
      servicio.actualesDeMiClinica().subscribe(respuesta => recibidos.push(respuesta));
    }

    http.expectOne(esDeMiClinica).flush(estados);

    expect(recibidos.length).toBe(3);
    expect(recibidos.every(respuesta => respuesta === recibidos[0])).toBeTrue();
  });

  it('una página que entra después recibe la respuesta guardada sin llamar de nuevo', () => {
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    let recibido: unknown;
    servicio.actualesDeMiClinica().subscribe(respuesta => recibido = respuesta);

    http.expectNone(esDeMiClinica);
    expect(recibido).toEqual(estados);
  });

  it('no mezcla clínicas ni roles', () => {
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    companyId = 9;
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    activeRoleId = 4;
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);
  });

  it('con la clínica elegida por un administrador de plataforma usa esa clínica como clave', () => {
    companyId = null;
    establecimiento = 21;
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    establecimiento = 22;
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    establecimiento = 21;
    servicio.actualesDeMiClinica().subscribe();
    http.expectNone(esDeMiClinica);
  });

  it('vuelve a pedir los datos pasado el minuto de validez', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 10, 13, 10, 0, 0));
      servicio.actualesDeMiClinica().subscribe();
      http.expectOne(esDeMiClinica).flush(estados);

      jasmine.clock().mockDate(new Date(2026, 10, 13, 10, 0, 59));
      servicio.actualesDeMiClinica().subscribe();
      http.expectNone(esDeMiClinica);

      jasmine.clock().mockDate(new Date(2026, 10, 13, 10, 1, 1));
      servicio.actualesDeMiClinica().subscribe();
      http.expectOne(esDeMiClinica).flush(estados);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('una llamada que falla no queda guardada', () => {
    servicio.actualesDeMiClinica().subscribe({ error: () => undefined });
    http.expectOne(esDeMiClinica).flush('error', { status: 500, statusText: 'Server Error' });

    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);
  });

  it('una solicitud de cambio enviada invalida los datos guardados', () => {
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    servicio.solicitarCambio(solicitud).subscribe();
    http.expectOne(candidate => candidate.method === 'POST' && candidate.url.endsWith('/me/compliance/requests'))
      .flush({ success: true, message: 'ok', data: {} });

    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);
  });

  it('una solicitud de cambio rechazada por el servidor no invalida los datos guardados', () => {
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    servicio.solicitarCambio(solicitud).subscribe({ error: () => undefined });
    http.expectOne(candidate => candidate.method === 'POST' && candidate.url.endsWith('/me/compliance/requests'))
      .flush('error', { status: 400, statusText: 'Bad Request' });

    servicio.actualesDeMiClinica().subscribe();
    http.expectNone(esDeMiClinica);
  });

  it('resolver una solicitud desde plataforma invalida los datos guardados', () => {
    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);

    servicio.resolverSolicitud(5, { aprobar: true, comentario: 'ok', confirmoRevisionLegal: true }).subscribe();
    http.expectOne(candidate => candidate.method === 'PUT' && candidate.url.endsWith('/platform/compliance/requests/5'))
      .flush({ success: true, message: 'ok', data: {} });

    servicio.actualesDeMiClinica().subscribe();
    http.expectOne(esDeMiClinica).flush(estados);
  });
});
