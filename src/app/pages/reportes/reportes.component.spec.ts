import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import ReportesComponent from './reportes.component';
import { AuthStore } from '../../store/auth.store';
import { ApiResponse } from '../../models/response/api-response';
import { ReportesClinicos } from '../../models/response/reportes-clinicos-response';
import { Page } from '../../models/response/page';
import { EmpleadoListResponse } from '../../models/response/empleado-list-response';

function reporteFixture(overrides: Partial<ReportesClinicos> = {}): ReportesClinicos {
  return {
    fechaDesde: '2026-07-01',
    fechaHasta: '2026-07-31',
    resumen: {
      consultas: 10, pacientesAtendidos: 6, ingresos: 500,
      nuevosPacientes: 2, tiempoPromedioAtencionMinutos: 12, porcentajeCitasCompletadas: 80
    },
    resumenAnterior: {
      consultas: 5, pacientesAtendidos: 3, ingresos: 200,
      nuevosPacientes: 1, tiempoPromedioAtencionMinutos: 10, porcentajeCitasCompletadas: 60
    },
    consultasPorTipo: [], consultasPorEstado: [], pacientesPorEspecie: [], pacientesPorRangoEdad: [],
    proximasVacunas: [], proximasDesparasitaciones: [], consultasPorMes: [], consultasPorVeterinario: [],
    frecuenciaConsultasPorPaciente: [], serviciosMasSolicitados: [], controlesPreventivosProximos: [],
    demandaPorHorario: [],
    ...overrides
  };
}

function empleadosPageFixture(items: EmpleadoListResponse[] = []): Page<EmpleadoListResponse> {
  return {
    content: items,
    totalElements: items.length,
    totalPages: 1,
    number: 0,
    size: items.length || 10
  } as Page<EmpleadoListResponse>;
}

describe('ReportesComponent', () => {
  let fixture: ComponentFixture<ReportesComponent>;
  let component: ReportesComponent;
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof AuthStore>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ReportesComponent, HttpClientTestingModule],
    })
      .overrideComponent(ReportesComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ReportesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    store.logout();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushInitialRequests(reporte = reporteFixture()) {
    fixture.detectChanges();

    const empleadosReq = httpMock.expectOne(req => req.url.includes('/admin/employees'));
    empleadosReq.flush({ success: true, message: '', data: empleadosPageFixture() } as ApiResponse<Page<EmpleadoListResponse>>);

    const reportesReq = httpMock.expectOne(req => req.url.includes('/clinical-reports'));
    reportesReq.flush({ success: true, message: '', data: reporte } as ApiResponse<ReportesClinicos>);
  }

  it('carga el reporte del backend y lo expone en la señal data()', () => {
    const reporte = reporteFixture({ resumen: { ...reporteFixture().resumen, consultas: 42 } });
    flushInitialRequests(reporte);

    expect(component.data()?.resumen.consultas).toBe(42);
  });

  it('variacion() calcula el cambio porcentual respecto al periodo anterior', () => {
    flushInitialRequests();

    expect(component.variacion(150, 100)).toBe(50);
    expect(component.variacion(50, 100)).toBe(-50);
  });

  it('variacion() devuelve null cuando no hay periodo anterior con datos (0 -> algo)', () => {
    flushInitialRequests();

    expect(component.variacion(10, 0)).toBeNull();
    expect(component.variacion(0, 0)).toBe(0);
  });

  it('variacionTexto() antepone la flecha correcta según el signo del cambio', () => {
    flushInitialRequests();

    expect(component.variacionTexto(150, 100)).toContain('↑');
    expect(component.variacionTexto(50, 100)).toContain('↓');
    expect(component.variacionTexto(10, 0)).toBe('Nuevo en este periodo');
  });

  it('onFiltrosChange() con un periodo rápido recalcula el rango y vuelve a pedir el reporte', () => {
    flushInitialRequests();

    component.periodo = 'mes';
    component.onFiltrosChange();

    const reportesReq = httpMock.expectOne(req => req.url.includes('/clinical-reports'));
    expect(reportesReq.request.params.get('fechaDesde')).toBeTruthy();
    expect(reportesReq.request.params.get('fechaHasta')).toBeTruthy();
    reportesReq.flush({ success: true, message: '', data: reporteFixture() } as ApiResponse<ReportesClinicos>);
  });

  it('onFiltrosChange() no dispara una nueva petición mientras el periodo es personalizado', () => {
    flushInitialRequests();

    component.periodo = 'personalizado';
    component.onFiltrosChange();

    expect(() => httpMock.expectNone(req => req.url.includes('/clinical-reports'))).not.toThrow();
  });

  it('limpiarFiltros() restablece periodo, veterinario y especie a sus valores por defecto', () => {
    flushInitialRequests();

    component.periodo = 'mes';
    component.veterinarioId = 7;
    component.especie = 'PERRO';

    component.limpiarFiltros();

    expect(component.periodo).toBe('todos');
    expect(component.veterinarioId).toBeNull();
    expect(component.especie).toBe('');

    const reportesReq = httpMock.expectOne(req => req.url.includes('/clinical-reports'));
    reportesReq.flush({ success: true, message: '', data: reporteFixture() } as ApiResponse<ReportesClinicos>);
  });

  it('heatmapCount() devuelve 0 cuando no hay datos para ese día/hora', () => {
    flushInitialRequests(reporteFixture({ demandaPorHorario: [{ diaSemana: 2, hora: 9, count: 4 }] }));

    expect(component.heatmapCount(2, 9)).toBe(4);
    expect(component.heatmapCount(3, 9)).toBe(0);
  });
});
