import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ApoderadoService } from './apoderado.service';
import { CitaService } from './cita.service';

describe('Cancelar una cita no es eliminarla', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('el personal cancela con PATCH, no con DELETE', () => {
    TestBed.inject(CitaService).cancelarCita(5, 'Cliente avisó').subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/appointments/5/cancel?motivo=Cliente%20avis%C3%B3`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('el cliente cancela su cita con PATCH, no con DELETE', () => {
    TestBed.inject(ApoderadoService).cancelarPortalCita(9, 'No puedo asistir').subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/clients/portal/appointments/9/cancel?motivo=No%20puedo%20asistir`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('eliminar una cita sigue siendo DELETE sobre la cita', () => {
    TestBed.inject(CitaService).eliminarCita(5).subscribe();

    const req = controller.expectOne(`${environment.apiUrl}/appointments/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
