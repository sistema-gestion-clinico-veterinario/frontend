import { TestBed } from '@angular/core/testing';
import { RouteMapperService } from './route-mapper.service';

describe('RouteMapperService', () => {
  let service: RouteMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RouteMapperService);
  });

  it('maps known backend view codes to frontend routes', () => {
    expect(service.getRoute('VISTA_CITAS_AGENDA_ADMIN')).toBe('/admin/citas/agenda');
    expect(service.getRoute('VISTA_HISTORIAS_CONSULTA_EMP')).toBe('/empleado/historias-clinicas/consulta/:consultaId');
  });

  it('returns null for unknown view codes', () => {
    expect(service.getRoute('VISTA_INEXISTENTE')).toBeNull();
  });

  it('returns the provided default route when code is unknown', () => {
    expect(service.getRouteOrDefault('VISTA_INEXISTENTE', '/dashboard')).toBe('/dashboard');
  });
});
