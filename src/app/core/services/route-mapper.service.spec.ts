import { TestBed } from '@angular/core/testing';
import { RouteMapperService } from './route-mapper.service';

describe('RouteMapperService', () => {
  let service: RouteMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RouteMapperService);
  });

  it('maps known backend view codes to frontend routes', () => {
    // Arrange
    const agendaCode = 'VISTA_CITAS_AGENDA_ADMIN';
    const consultaCode = 'VISTA_HISTORIAS_CONSULTA_EMP';

    // Act
    const agendaRoute = service.getRoute(agendaCode);
    const consultaRoute = service.getRoute(consultaCode);

    // Assert
    expect(agendaRoute).toBe('/admin/citas/agenda');
    expect(consultaRoute).toBe('/empleado/historias-clinicas/consulta/:consultaId');
  });

  it('returns null for unknown view codes', () => {
    // Arrange
    const unknownCode = 'VISTA_INEXISTENTE';

    // Act
    const route = service.getRoute(unknownCode);

    // Assert
    expect(route).toBeNull();
  });

  it('returns the provided default route when code is unknown', () => {
    // Arrange
    const unknownCode = 'VISTA_INEXISTENTE';
    const defaultRoute = '/dashboard';

    // Act
    const route = service.getRouteOrDefault(unknownCode, defaultRoute);

    // Assert
    expect(route).toBe(defaultRoute);
  });
});
