import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CamposAvisoPrivacidad, PrivacidadService } from './privacidad.service';
import { environment } from '../../../environments/environment';

describe('PrivacidadService - aviso de la clínica', () => {
  let service: PrivacidadService;
  let httpMock: HttpTestingController;
  const campos = { razonSocial: 'Clínica Patitas S.A.C.' } as CamposAvisoPrivacidad;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PrivacidadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('la vista previa envía los campos al servidor sin publicar nada', () => {
    service.vistaPrevia(campos).subscribe(r => expect(r.data.version).toBe(2));

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/privacidad/aviso/vista-previa`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ audiencia: 'PROPIETARIOS_Y_AUTORIZADOS', campos });
    req.flush({ success: true, message: 'ok', data: { version: 2, contenido: 'AVISO', sinCambios: false, observaciones: [] } });
  });

  it('publicar sigue siendo una llamada aparte, que lleva la confirmación legal', () => {
    service.publicar(campos, true).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/privacidad/aviso`);
    expect(req.request.body).toEqual({ audiencia: 'PROPIETARIOS_Y_AUTORIZADOS', campos, confirmoRevisionLegal: true });
    req.flush({ success: true, message: 'ok', data: {} });
  });

  it('consulta por separado la plantilla y el historial de cada audiencia', () => {
    service.plantilla('TRABAJADORES_Y_USUARIOS').subscribe();
    const plantilla = httpMock.expectOne(req => req.url.endsWith('/admin/privacidad/aviso/plantilla'));
    expect(plantilla.request.params.get('audiencia')).toBe('TRABAJADORES_Y_USUARIOS');
    plantilla.flush({ success: true, message: 'ok', data: campos });

    service.historial('TRABAJADORES_Y_USUARIOS').subscribe();
    const historial = httpMock.expectOne(req => req.url.endsWith('/admin/privacidad/aviso/historial'));
    expect(historial.request.params.get('audiencia')).toBe('TRABAJADORES_Y_USUARIOS');
    historial.flush({ success: true, message: 'ok', data: [] });
  });
});
