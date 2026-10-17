import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RazaService } from './raza.service';
import { ServicioService } from './servicio.service';

describe('Catalog request caching', () => {
  let http: HttpTestingController;
  let razas: RazaService;
  let servicios: ServicioService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    http = TestBed.inject(HttpTestingController);
    razas = TestBed.inject(RazaService);
    servicios = TestBed.inject(ServicioService);
  });

  afterEach(() => http.verify());

  it('shares a breed request for the same clinic and species', () => {
    const received: unknown[] = [];
    razas.listarPorEspecie('PERRO', 8).subscribe((response) => received.push(response));
    razas.listarPorEspecie('PERRO', 8).subscribe((response) => received.push(response));

    const request = http.expectOne((candidate) =>
      candidate.urlWithParams.endsWith('/breeds?especie=PERRO&companyId=8')
    );
    request.flush({ success: true, message: 'ok', data: [] });

    expect(received.length).toBe(2);
  });

  it('invalidates available services after a successful mutation', () => {
    let availableResponses = 0;
    servicios.listarDisponibles(8).subscribe(() => availableResponses += 1);
    http.expectOne((candidate) => candidate.url.includes('/services/available')).flush({
      success: true,
      message: 'ok',
      data: []
    });

    servicios.toggleDisponible(12).subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/services/12/toggle')).flush({
      success: true,
      message: 'ok',
      data: { id: 12 }
    });

    servicios.listarDisponibles(8).subscribe(() => availableResponses += 1);
    http.expectOne((candidate) => candidate.url.includes('/services/available')).flush({
      success: true,
      message: 'ok',
      data: []
    });

    expect(availableResponses).toBe(2);
  });
});
