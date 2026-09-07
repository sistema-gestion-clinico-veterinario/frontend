import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThesisPerformanceMeasurementService } from '../../../core/services/thesis-performance-measurement.service';
import {
  ThesisPerformanceSessionService
} from '../../../core/services/thesis-performance-session.service';
import {
  ThesisMeasurementPhase,
  ThesisPerformanceMeasurement
} from '../../../models/response/thesis-performance-measurement-response';

@Component({
  selector: 'app-instrumento-1',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instrumento-1.component.html'
})
export class Instrumento1Component {
  private readonly measurementsService = inject(ThesisPerformanceMeasurementService);
  private readonly sessionService = inject(ThesisPerformanceSessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly session = this.sessionService.state;
  readonly measurements = signal<ThesisPerformanceMeasurement[]>([]);
  readonly loading = signal(false);
  readonly message = signal<string | null>(null);

  readonly warmupCount = computed(() => this.measurements().filter((item) => item.phase === 'WARMUP').length);
  readonly sampleCount = computed(() => this.measurements().filter((item) => item.phase === 'SAMPLE').length);
  readonly validSamples = computed(() => this.measurements().filter((item) => item.phase === 'SAMPLE' && item.successful));
  readonly failedSamples = computed(() => this.measurements().filter((item) => item.phase === 'SAMPLE' && !item.successful).length);
  readonly averageMs = computed(() => this.mean(this.validSamples().map((item) => Number(item.durationMs))));
  readonly medianMs = computed(() => this.percentile(this.validSamples().map((item) => Number(item.durationMs)), 0.5));
  readonly p95Ms = computed(() => this.percentile(this.validSamples().map((item) => Number(item.durationMs)), 0.95));

  constructor() {
    timer(0, 3000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh(false));
  }

  startNewSession(): void {
    const current = this.session();
    if (current && !window.confirm('Se conservará la sesión anterior en la base de datos y se iniciará una nueva. ¿Deseas continuar?')) {
      return;
    }
    this.sessionService.startNew();
    this.measurements.set([]);
    this.message.set('Sesión iniciada en calentamiento. Ejecuta primero las operaciones de práctica.');
  }

  setPhase(phase: ThesisMeasurementPhase): void {
    this.sessionService.setPhase(phase);
    this.message.set(phase === 'WARMUP'
      ? 'Fase de calentamiento activa. Estos registros no entrarán al promedio.'
      : 'Fase de muestra activa. Las operaciones críticas exitosas entrarán al indicador.');
  }

  toggleCapture(): void {
    const current = this.session();
    if (!current) return;
    current.active ? this.sessionService.pause() : this.sessionService.resume();
  }

  refresh(showMessage = true): void {
    const current = this.session();
    if (!current || this.loading()) return;
    this.loading.set(true);
    this.measurementsService.findSession(current.id).subscribe({
      next: (response) => {
        this.measurements.set(response.data ?? []);
        this.loading.set(false);
        if (showMessage) this.message.set('Mediciones actualizadas desde el servidor.');
      },
      error: () => {
        this.loading.set(false);
        if (showMessage) this.message.set('No se pudieron recuperar las mediciones. Verifica el despliegue y la migración V58.');
      }
    });
  }

  openClinicalRecords(): void {
    window.open('/historias-clinicas', '_blank', 'noopener,noreferrer');
  }

  formatDateTime(value: string): string {
    const date = new Date(`${value}-05:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-PE', { hour12: false });
  }

  formatMs(value: number): string {
    return `${Number(value).toFixed(3)} ms`;
  }

  async exportExcel(): Promise<void> {
    const session = this.session();
    if (!session || this.measurements().length === 0) return;

    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Vargas Vet';
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    this.buildSummarySheet(workbook);
    this.buildMeasurementsSheet(workbook);
    this.buildInstructionsSheet(workbook);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Instrumento_1_Rendimiento_${this.formatFileDate(new Date())}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildMeasurementsSheet(workbook: any): void {
    const sheet = workbook.addWorksheet('1_Mediciones', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
    sheet.columns = [
      { width: 7 }, { width: 15 }, { width: 14 }, { width: 19 }, { width: 31 }, { width: 35 },
      { width: 13 }, { width: 24 }, { width: 20 }, { width: 14 }, { width: 13 }, { width: 40 }
    ];
    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = 'Tabla 1. Tiempo de respuesta del sistema en operaciones críticas de gestión de historias clínicas';
    this.styleTitle(sheet.getCell('A1'));
    sheet.getRow(3).values = [
      'N.°', 'Fase', 'Fecha', 'Hora de petición (servidor)', 'Operación crítica',
      'Endpoint / ruta URL solicitada', 'Método HTTP', 'Tiempo de respuesta (ms)',
      'Código de estado HTTP', 'Resultado', 'Empresa ID', 'ID de sesión'
    ];
    this.styleHeaderRow(sheet.getRow(3));

    this.measurements().forEach((item, index) => {
      const requestedAt = this.parseLocalDateTime(item.requestedAt);
      const row = sheet.getRow(index + 4);
      row.values = [
        index + 1,
        item.phase === 'WARMUP' ? 'Calentamiento' : 'Muestra',
        requestedAt.date,
        requestedAt.time,
        item.operationName,
        item.routeTemplate,
        item.httpMethod,
        Number(item.durationMs),
        item.httpStatus,
        item.successful ? 'Éxito' : 'Fallo',
        item.companyId ?? '',
        item.measurementSessionId
      ];
      row.eachCell((cell: any) => this.styleBodyCell(cell));
    });

    const lastRow = Math.max(4, this.measurements().length + 3);
    sheet.getColumn(3).numFmt = 'yyyy-mm-dd';
    sheet.getColumn(8).numFmt = '0.000';
    sheet.autoFilter = `A3:L${lastRow}`;
  }

  private buildSummarySheet(workbook: any): void {
    const sheet = workbook.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
    sheet.columns = [{ width: 42 }, { width: 18 }, { width: 5 }, { width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }];
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = 'Resumen del Instrumento 1 - Rendimiento del sistema';
    this.styleTitle(sheet.getCell('A1'));

    const metrics: Array<[string, number]> = [
      ['Registros de calentamiento (excluidos)', this.warmupCount()],
      ['Solicitudes registradas como muestra', this.sampleCount()],
      ['Muestras exitosas incluidas (n)', this.validSamples().length],
      ['Muestras fallidas conservadas', this.failedSamples()],
      ['Tiempo promedio de respuesta (ms)', this.averageMs()],
      ['Mediana (ms)', this.medianMs()],
      ['Percentil 95 (ms)', this.p95Ms()]
    ];
    metrics.forEach(([label, value], index) => {
      const row = index + 3;
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`B${row}`).value = value;
      sheet.getCell(`A${row}`).font = { name: 'Arial', bold: true, color: { argb: 'FF334155' } };
      sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FF' } };
      this.styleBodyCell(sheet.getCell(`A${row}`));
      this.styleBodyCell(sheet.getCell(`B${row}`));
    });
    sheet.getRange('B7:B9').numFmt = '0.000';

    sheet.getRow(3).getCell(4).value = 'Operación crítica';
    sheet.getRow(3).getCell(5).value = 'n exitosas';
    sheet.getRow(3).getCell(6).value = 'Promedio (ms)';
    sheet.getRow(3).getCell(7).value = 'P95 (ms)';
    this.styleHeaderRow(sheet.getRow(3), 4, 7);
    this.operationSummaries().forEach((item, index) => {
      const row = index + 4;
      sheet.getCell(`D${row}`).value = item.name;
      sheet.getCell(`E${row}`).value = item.count;
      sheet.getCell(`F${row}`).value = item.average;
      sheet.getCell(`G${row}`).value = item.p95;
      ['D', 'E', 'F', 'G'].forEach((column) => this.styleBodyCell(sheet.getCell(`${column}${row}`)));
    });
    sheet.getRange('F4:G20').numFmt = '0.000';

    sheet.mergeCells('A12:G12');
    sheet.getCell('A12').value = 'Criterio de cálculo';
    sheet.getCell('A12').font = { name: 'Arial', bold: true, color: { argb: 'FF004B80' } };
    sheet.getCell('A12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FF' } };
    const notes = [
      'TPR = Σ ti / n. ti es el tiempo técnico de cada solicitud crítica exitosa en fase Muestra; n es el número de solicitudes exitosas.',
      'Los registros de Calentamiento y las respuestas fallidas se conservan como evidencia, pero no forman parte del promedio principal.',
      'El tiempo se mide en el backend con reloj monotónico desde la entrada al filtro hasta que finaliza el procesamiento del controlador.',
      'La ruta se guarda como plantilla. No se almacenan parámetros de búsqueda, identificadores de pacientes ni contenido clínico.'
    ];
    notes.forEach((note, index) => {
      const row = 13 + index;
      sheet.mergeCells(`A${row}:G${row}`);
      sheet.getCell(`A${row}`).value = note;
      sheet.getCell(`A${row}`).alignment = { wrapText: true, vertical: 'middle' };
      sheet.getRow(row).height = 30;
    });
  }

  private buildInstructionsSheet(workbook: any): void {
    const sheet = workbook.addWorksheet('Instructivo', { views: [{ showGridLines: false }] });
    sheet.columns = [{ width: 29 }, { width: 92 }];
    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').value = 'INSTRUMENTO 1. FICHA AUTOMÁTICA DE TIEMPOS DE RESPUESTA';
    this.styleTitle(sheet.getCell('A1'));
    sheet.addRows([
      [],
      ['Variable independiente:', 'Sistema de información web'],
      ['Dimensión:', 'Rendimiento del sistema'],
      ['Indicador:', 'Tiempo promedio de respuesta en operaciones críticas de gestión de historias clínicas (ms)'],
      ['Técnica:', 'Observación técnica automatizada del servidor'],
      ['Unidad de análisis:', 'Solicitud HTTP correspondiente a una operación crítica'],
      ['Unidad de medida:', 'Milisegundos (ms), con tres decimales'],
      [],
      ['PROCEDIMIENTO'],
      ['1.', 'Inicie una nueva sesión desde la pantalla Instrumento 1.'],
      ['2.', 'Mantenga la fase Calentamiento y ejecute al menos dos veces cada operación que vaya a evaluar.'],
      ['3.', 'Cambie a fase Muestra. Ejecute el mismo protocolo y condiciones para todas las operaciones.'],
      ['4.', 'El backend registrará automáticamente las solicitudes críticas. No use un cronómetro manual.'],
      ['5.', 'Pause la captura al terminar y actualice los datos antes de exportar.'],
      ['6.', 'Conserve el archivo original exportado como evidencia. No modifique las mediciones crudas.'],
      [],
      ['OPERACIONES REGISTRADAS'],
      ['Buscar historias clínicas', 'GET /medical-records'],
      ['Recuperar historia clínica', 'GET /medical-records/{id}, /pet/{petId} o /numero/{numeroHc}'],
      ['Iniciar atención clínica', 'PATCH /appointments/{id}/start'],
      ['Guardar atención clínica', 'PUT /consultations/{id} o PATCH /consultations/{id}/close']
    ]);
    sheet.getRange('A3:B24').format.font = { name: 'Arial', size: 10 };
    sheet.getRange('A3:A24').format.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    sheet.getRange('A3:B24').format.alignment = { vertical: 'middle', wrapText: true };
    sheet.getRange('A3:B24').format.borders = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  }

  private operationSummaries(): Array<{ name: string; count: number; average: number; p95: number }> {
    const groups = new Map<string, number[]>();
    this.validSamples().forEach((item) => {
      const values = groups.get(item.operationName) ?? [];
      values.push(Number(item.durationMs));
      groups.set(item.operationName, values);
    });
    return Array.from(groups.entries()).map(([name, values]) => ({
      name,
      count: values.length,
      average: this.mean(values),
      p95: this.percentile(values, 0.95)
    }));
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
  }

  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
    return Number(sorted[index].toFixed(3));
  }

  private parseLocalDateTime(value: string): { date: Date; time: string } {
    const [datePart, timePart = ''] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    return {
      date: new Date(year, month - 1, day),
      time: timePart.slice(0, 12)
    };
  }

  private formatFileDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private styleTitle(cell: any): void {
    cell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0066AA' } } };
    cell.worksheet.getRow(cell.row).height = 34;
  }

  private styleHeaderRow(row: any, from = 1, to = 12): void {
    for (let column = from; column <= to; column++) {
      const cell = row.getCell(column);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005B96' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
    }
    row.height = 34;
  }

  private styleBodyCell(cell: any): void {
    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', wrapText: false };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
  }
}
