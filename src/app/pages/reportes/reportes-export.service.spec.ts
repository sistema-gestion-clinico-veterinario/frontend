import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import ExcelJS from 'exceljs';
import { AuditLogService } from '../../core/services/audit-log.service';
import { ReportesClinicos } from '../../models/response/reportes-clinicos-response';
import { ReportesExportService } from './reportes-export.service';

function reporteFiltrado(): ReportesClinicos {
  return {
    fechaDesde: '2026-10-01',
    fechaHasta: '2026-10-15',
    resumen: {
      consultas: 7,
      pacientesAtendidos: 5,
      ingresos: 315.5,
      nuevosPacientes: 2,
      tiempoPromedioAtencionMinutos: 18,
      porcentajeCitasCompletadas: 85.7,
      noAsistieron: 1
    },
    resumenAnterior: {
      consultas: 4,
      pacientesAtendidos: 3,
      ingresos: 180,
      nuevosPacientes: 1,
      tiempoPromedioAtencionMinutos: 21,
      porcentajeCitasCompletadas: 75,
      noAsistieron: 2
    },
    consultasPorTipo: [{ label: 'Control', count: 4 }, { label: 'Emergencia', count: 3 }],
    consultasPorEstado: [{ label: 'Completada', count: 6 }, { label: 'No asistió', count: 1 }],
    pacientesPorEspecie: [{ label: 'Perro', count: 5 }],
    pacientesPorRangoEdad: null,
    proximasVacunas: [{ mascota: 'Luna', producto: 'Rabia', tipoControl: 'VACUNA', fechaProxima: '2026-11-01' }],
    proximasDesparasitaciones: null,
    consultasPorMes: [{ label: 'Octubre', count: 7 }],
    consultasPorVeterinario: [{ label: 'Dra. Ana', count: 7 }],
    frecuenciaConsultasPorPaciente: null,
    serviciosMasSolicitados: null,
    controlesPreventivosProximos: null,
    demandaPorHorario: [{ diaSemana: 1, hora: 9, count: 3 }],
    ingresosPorMetodoPago: [{ label: 'Yape', monto: 315.5 }],
    ingresosPorServicio: null,
    cumplimientoVacunacion: null,
    cumplimientoDesparasitacion: null,
    pacientesFrecuentes: null,
    vacunasMasAplicadas: null,
    desparasitantesMasAplicados: null,
    pacientesInactivos: [{ mascota: 'Rocky', apoderado: 'María Pérez', ultimaVisita: '2026-06-01', diasSinVisitar: 136 }]
  };
}

describe('ReportesExportService', () => {
  let service: ReportesExportService;
  let auditLogService: jasmine.SpyObj<AuditLogService>;
  let generatedBlob: Blob | undefined;

  beforeEach(() => {
    auditLogService = jasmine.createSpyObj<AuditLogService>('AuditLogService', ['registrarDescarga']);
    auditLogService.registrarDescarga.and.returnValue(of(null));

    TestBed.configureTestingModule({
      providers: [
        ReportesExportService,
        { provide: AuditLogService, useValue: auditLogService }
      ]
    });
    service = TestBed.inject(ReportesExportService);

    generatedBlob = undefined;
    spyOn(URL, 'createObjectURL').and.callFake(blob => {
      generatedBlob = blob as Blob;
      return 'blob:reporte-clinico-prueba';
    });
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
  });

  it('exporta a Excel exactamente el periodo, indicadores y filas del reporte filtrado mostrado', async () => {
    const reporte = reporteFiltrado();

    await service.exportarExcel(reporte);

    expect(generatedBlob).withContext('Debe generar un archivo XLSX').toBeDefined();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await generatedBlob!.arrayBuffer());

    const resumen = workbook.getWorksheet('Resumen');
    expect(resumen).toBeDefined();
    const valoresResumen = resumen!.getSheetValues().flat().filter(valor => valor != null);
    expect(valoresResumen).toContain(`Periodo: ${reporte.fechaDesde} al ${reporte.fechaHasta}`);
    expect(valoresResumen).toContain(reporte.resumen.consultas);
    expect(valoresResumen).toContain(reporte.resumen.pacientesAtendidos);
    expect(valoresResumen).toContain(reporte.resumen.ingresos!);

    const tipos = workbook.getWorksheet('Consultas por tipo');
    expect(tipos?.getRow(2).values).toEqual([undefined, 'Control', 4]);
    expect(tipos?.getRow(3).values).toEqual([undefined, 'Emergencia', 3]);

    const veterinarios = workbook.getWorksheet('Consultas por empleado');
    expect(veterinarios?.getRow(2).values).toEqual([undefined, 'Dra. Ana', 7]);

    const inactivos = workbook.getWorksheet('Pacientes inactivos');
    expect(inactivos?.getRow(2).values).toEqual([undefined, 'Rocky', 'María Pérez', '2026-06-01', 136]);

    const demanda = workbook.getWorksheet('Demanda por horario');
    expect(demanda?.getRow(2).values).toEqual([undefined, 'Lunes', '09:00', 3]);
    expect(auditLogService.registrarDescarga).toHaveBeenCalledOnceWith(
      'REPORTE_CLINICO_EXCEL',
      '2026-10-01 a 2026-10-15'
    );
  });

  it('no incorpora secciones sin datos que no aparecen en el reporte filtrado', async () => {
    await service.exportarExcel(reporteFiltrado());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await generatedBlob!.arrayBuffer());

    expect(workbook.getWorksheet('Pacientes por rango de edad')).toBeUndefined();
    expect(workbook.getWorksheet('Próximas desparasitaciones')).toBeUndefined();
    expect(workbook.getWorksheet('Ingresos por servicio')).toBeUndefined();
  });
});
