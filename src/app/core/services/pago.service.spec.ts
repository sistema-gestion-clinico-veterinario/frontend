import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PagoService } from './pago.service';
import { environment } from '../../../environments/environment';

describe('PagoService integration', () => {
  let service: PagoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(PagoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe enviar Yape como método de registro manual', () => {
    service.registrar({
      citaId: 15,
      metodoPago: 'YAPE',
    }).subscribe((response) => {
      expect(response.success).toBeTrue();
      expect(response.data.estado).toBe('PAID');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      citaId: 15,
      metodoPago: 'YAPE',
    });

    req.flush({
      success: true,
      message: 'Pago registrado exitosamente',
      data: {
        id: 80,
        citaId: 15,
        metodoPago: 'YAPE',
        monto: 100,
        montoRecibido: null,
        cambio: null,
        fechaPago: '2026-07-07T10:00:00',
        estado: 'PAID',
      },
    });
  });

  it('envía los filtros del historial al backend junto con la paginación', () => {
    service.listarHistorialPorEmpresa(2, 25, 8, {
      estado: 'PAID',
      metodoPago: 'YAPE'
    }).subscribe();

    const req = httpMock.expectOne((candidate) => candidate.url === `${environment.apiUrl}/payments/history`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('companyId')).toBe('8');
    expect(req.request.params.get('estado')).toBe('PAID');
    expect(req.request.params.get('metodoPago')).toBe('YAPE');
    req.flush({ success: true, message: 'ok', data: { content: [], totalElements: 0 } });
  });
});
