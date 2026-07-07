import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LaboratorioIaService } from './laboratorio-ia.service';
import { environment } from '../../../environments/environment';

describe('LaboratorioIaService integration', () => {
  let service: LaboratorioIaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(LaboratorioIaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe enviar archivo y especie para analisis IA de laboratorio', () => {
    const file = new File(['hemograma'], 'hemograma.pdf', { type: 'application/pdf' });

    service.analizar(file, 'PERRO').subscribe((response) => {
      expect(response.tipo).toBe('laboratorio');
      expect(response.especie).toBe('PERRO');
      expect(response.alertas).toContain('Leucocitos altos');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/laboratorio/analizar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect(req.request.body.get('archivo')).toBe(file);
    expect(req.request.body.get('especie')).toBe('PERRO');

    req.flush({
      success: true,
      message: 'Analisis generado',
      data: {
        tipo: 'laboratorio',
        especie: 'PERRO',
        alertas: ['Leucocitos altos'],
      },
    });
  });

  it('debe propagar error si el backend de IA falla', () => {
    const file = new File(['bad'], 'hemograma.pdf', { type: 'application/pdf' });

    service.analizar(file, 'PERRO').subscribe({
      next: () => fail('No debe responder exitoso si IA falla'),
      error: (error) => {
        expect(error.status).toBe(503);
        expect(error.error.message).toContain('IA no disponible');
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/laboratorio/analizar`);
    req.flush(
      { success: false, message: 'IA no disponible' },
      { status: 503, statusText: 'Service Unavailable' }
    );
  });
});
