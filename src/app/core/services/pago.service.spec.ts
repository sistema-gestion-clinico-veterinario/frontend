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

  it('debe enviar pago Yape sandbox aprobado al endpoint de pagos', () => {
    service.registrar({
      citaId: 15,
      metodoPago: 'YAPE',
      yapePhoneNumber: 111111111,
      yapeOtp: 123456,
      payerEmail: 'cliente@yape.test',
    }).subscribe((response) => {
      expect(response.success).toBeTrue();
      expect(response.data.estado).toBe('PAID');
      expect(response.data.mpStatus).toBe('approved');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      citaId: 15,
      metodoPago: 'YAPE',
      yapePhoneNumber: 111111111,
      yapeOtp: 123456,
      payerEmail: 'cliente@yape.test',
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
        mercadoPagoId: 'mp-approved-001',
        mpStatus: 'approved',
      },
    });
  });

  it('debe propagar el rechazo sandbox de Mercado Pago Yape', () => {
    service.registrar({
      citaId: 16,
      metodoPago: 'YAPE',
      yapePhoneNumber: 111111113,
      yapeOtp: 123456,
      payerEmail: 'cliente@yape.test',
    }).subscribe({
      next: () => fail('El pago Yape rechazado no debe responder como exitoso'),
      error: (error) => {
        expect(error.status).toBe(400);
        expect(error.error.message).toContain('Saldo insuficiente en Yape');
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/payments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.yapePhoneNumber).toBe(111111113);
    expect(req.request.body.yapeOtp).toBe(123456);

    req.flush(
      { success: false, message: 'Saldo insuficiente en Yape. El cliente debe recargar su cuenta.' },
      { status: 400, statusText: 'Bad Request' }
    );
  });
});
