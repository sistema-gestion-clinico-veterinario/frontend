import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HistoriaClinicaService } from './historia-clinica.service';
import { environment } from '../../../environments/environment';

describe('HistoriaClinicaService integration', () => {
  let service: HistoriaClinicaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(HistoriaClinicaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe actualizar consulta clinica enviando version y datos medicos', () => {
    const request = {
      version: 3,
      pesoEnConsulta: 12.8,
      temperatura: 38.6,
      anamnesis: 'Paciente estable',
      antecedentesEnfermedades: 'Dermatitis previa',
    };
    service.updateConsulta(44, request).subscribe((response) => {
      expect(response.success).toBeTrue();
      expect(response.data.id).toBe(44);
      expect(response.data.pesoEnConsulta).toBe(12.8);
      expect(response.data.antecedentesEnfermedades).toBe('Dermatitis previa');
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/consultations/44`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({
      success: true,
      message: 'Consulta actualizada',
      data: {
        id: 44,
        version: 4,
        estado: 'ABIERTA',
        pesoEnConsulta: 12.8,
        antecedentesEnfermedades: 'Dermatitis previa',
      },
    });
  });
  it('debe cerrar consulta clinica y recibir estado cerrado', () => {
    service.cerrarConsulta(44, { version: 4 }).subscribe((response) => {
      expect(response.success).toBeTrue();
      expect(response.data.id).toBe(44);
      expect(response.data.estado).toBe('CERRADA');
      expect(response.data.cerradoPor).toBe('doctor@vargasvet.test');
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/consultations/44/close`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ version: 4 });
    req.flush({
      success: true,
      message: 'Consulta cerrada',
      data: {
        id: 44,
        version: 5,
        estado: 'CERRADA',
        cerradoPor: 'doctor@vargasvet.test',
      },
    });
  });
});
