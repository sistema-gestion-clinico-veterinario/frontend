import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { IaAutorizacionService, esErrorDeAutorizacionIa } from './ia-autorizacion.service';
import { environment } from '../../../environments/environment';

describe('IaAutorizacionService', () => {
  let service: IaAutorizacionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(IaAutorizacionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('consulta la autorización de la mascota en el servidor', () => {
    service.autorizacion(7).subscribe(r => {
      expect(r.data.autorizada).toBeTrue();
      expect(r.data.titular).toBe('Ana Pérez');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/ia/autorizacion/mascotas/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', data: { autorizada: true, apoderadoId: 5, titular: 'Ana Pérez', fecha: '2026-10-06T10:00:00', canal: 'PORTAL' } });
  });

  describe('esErrorDeAutorizacionIa', () => {
    const cuerpo = { success: false, message: 'x', data: { code: 'IA_SIN_AUTORIZACION', apoderadoId: 5 } };

    it('reconoce el rechazo por falta de autorización, venga como objeto o como texto', () => {
      expect(esErrorDeAutorizacionIa({ status: 403, error: cuerpo })).toBeTrue();
      expect(esErrorDeAutorizacionIa({ status: 403, error: JSON.stringify(cuerpo) })).toBeTrue();
    });

    it('no confunde otros errores con la falta de autorización', () => {
      expect(esErrorDeAutorizacionIa({ status: 403, error: { data: { code: 'OTRO' } } })).toBeFalse();
      expect(esErrorDeAutorizacionIa({ status: 500, error: cuerpo })).toBeFalse();
      expect(esErrorDeAutorizacionIa({ status: 403, error: 'no es json' })).toBeFalse();
      expect(esErrorDeAutorizacionIa(null)).toBeFalse();
    });
  });
});
