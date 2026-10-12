import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReportesClinicosService } from './reportes-clinicos.service';
import { environment } from '../../../environments/environment';

describe('ReportesClinicosService', () => {
  let service: ReportesClinicosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ReportesClinicosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía todos los filtros operativos al endpoint de ventas y productos', () => {
    service.obtenerVentasProductos({
      companyId: 9,
      fechaDesde: '2026-07-01',
      fechaHasta: '2026-07-31',
      metodoPago: 'YAPE',
      categoriaId: 10,
      productoId: 20,
      marcaId: 30,
      estadoStock: 'BAJO'
    }).subscribe();

    const request = http.expectOne(req => req.url === `${environment.apiUrl}/clinical-reports/sales-products`);
    expect(request.request.params.get('companyId')).toBe('9');
    expect(request.request.params.get('metodoPago')).toBe('YAPE');
    expect(request.request.params.get('categoriaId')).toBe('10');
    expect(request.request.params.get('productoId')).toBe('20');
    expect(request.request.params.get('marcaId')).toBe('30');
    expect(request.request.params.get('estadoStock')).toBe('BAJO');
    request.flush({ success: true, message: '', data: null });
  });
});
