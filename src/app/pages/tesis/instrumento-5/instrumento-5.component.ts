import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../store/auth.store';

type SearchCriterion = 'Por Codigo de Historia' | 'Por Nombre de Mascota' | 'Por Apellido Propietario';
type SearchResult = 'Exito' | 'Fallo';

interface ThesisMeasurement {
  id: string;
  number: number;
  date: string;
  startTime: string;
  endTime: string;
  shift: string;
  user: string;
  codigoHc: string;
  paciente: string;
  propietario: string;
  criterio: SearchCriterion;
  timeMs: number;
  result: SearchResult;
  observations: string;
}

interface ActiveMeasurementDraft {
  startedAt: number;
  startTime: string;
  date: string;
  number: number;
  shift: string;
  user: string;
  codigoHc: string;
  paciente: string;
  propietario: string;
  criterio: SearchCriterion;
  observations: string;
}

@Component({
  selector: 'app-instrumento-5',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './instrumento-5.component.html'
})
export class Instrumento5Component {
  private readonly authStore = inject(AuthStore);
  private readonly storageKey = 'vargasvet.instrumento5.postest.measurements';
  private readonly activeKey = 'vargasvet.instrumento5.postest.active';

  readonly criteria: SearchCriterion[] = [
    'Por Codigo de Historia',
    'Por Nombre de Mascota',
    'Por Apellido Propietario'
  ];
  readonly shifts = ['Manana', 'Tarde', 'Noche'];

  readonly measurements = signal<ThesisMeasurement[]>(this.loadMeasurements());
  readonly active = signal<ActiveMeasurementDraft | null>(this.loadActive());
  readonly message = signal<string | null>(null);

  caseNumber = this.nextNumber();
  shift = this.resolveShift();
  user = this.authStore.nombreCompleto() ?? '';
  codigoHc = '';
  paciente = '';
  propietario = '';
  criterio: SearchCriterion = 'Por Codigo de Historia';
  observations = '';

  readonly successfulCount = computed(() => this.measurements().filter((item) => item.result === 'Exito').length);
  readonly failedCount = computed(() => this.measurements().filter((item) => item.result === 'Fallo').length);
  readonly averageMs = computed(() => {
    const successful = this.measurements().filter((item) => item.result === 'Exito');
    if (successful.length === 0) return 0;
    return Math.round(successful.reduce((sum, item) => sum + item.timeMs, 0) / successful.length);
  });

  startMeasurement() {
    const sanitized = this.sanitizeDraft();
    if (!sanitized) return;

    const now = new Date();
    const draft: ActiveMeasurementDraft = {
      startedAt: Date.now(),
      startTime: this.formatTime(now),
      date: this.formatDate(now),
      number: this.caseNumber,
      shift: this.shift,
      user: this.user.trim(),
      codigoHc: this.codigoHc.trim().toUpperCase(),
      paciente: this.paciente.trim(),
      propietario: this.propietario.trim(),
      criterio: this.criterio,
      observations: this.observations.trim()
    };

    this.active.set(draft);
    this.persistActive(draft);
    this.message.set('Medicion iniciada. Realiza la busqueda y marca el resultado al validar la historia clinica.');
  }

  finishMeasurement(result: SearchResult) {
    const active = this.active();
    if (!active) return;

    const now = new Date();
    const elapsed = Math.max(0, Date.now() - active.startedAt);
    const row: ThesisMeasurement = {
      id: crypto.randomUUID(),
      number: active.number,
      date: active.date,
      startTime: active.startTime,
      endTime: this.formatTime(now),
      shift: active.shift,
      user: active.user,
      codigoHc: active.codigoHc,
      paciente: active.paciente,
      propietario: active.propietario,
      criterio: active.criterio,
      timeMs: elapsed,
      result,
      observations: this.observations.trim() || active.observations
    };

    const next = [...this.measurements(), row].sort((a, b) => a.number - b.number || a.startTime.localeCompare(b.startTime));
    this.measurements.set(next);
    this.persistMeasurements(next);
    this.clearActive();
    this.resetForNextCase();
    this.message.set(result === 'Exito' ? 'Busqueda registrada como exitosa.' : 'Busqueda registrada como fallo.');
  }

  cancelActive() {
    this.clearActive();
    this.message.set('Medicion activa cancelada. No se registro ningun tiempo.');
  }

  deleteMeasurement(id: string) {
    const next = this.measurements().filter((item) => item.id !== id);
    this.measurements.set(next);
    this.persistMeasurements(next);
    this.caseNumber = this.nextNumber();
  }

  clearAll() {
    const ok = window.confirm('Se eliminaran todas las mediciones guardadas en este navegador. Esta accion no afecta la base de datos. Deseas continuar?');
    if (!ok) return;
    this.measurements.set([]);
    localStorage.removeItem(this.storageKey);
    this.caseNumber = 1;
    this.message.set('Mediciones locales eliminadas.');
  }

  openClinicalRecords() {
    window.open('/historias-clinicas', '_blank', 'noopener,noreferrer');
  }

  async exportExcel() {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Vargas Vet';
    workbook.created = new Date();

    this.buildInstructionSheet(workbook);
    this.buildPosttestSheet(workbook);
    this.buildSummarySheet(workbook);
    this.buildListsSheet(workbook);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Instrumento_5_Postest_Tiempos_Busqueda_${this.formatDate(new Date())}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  formatDuration(ms: number): string {
    return `${(ms / 1000).toFixed(3)} s`;
  }

  private sanitizeDraft(): boolean {
    this.message.set(null);
    this.codigoHc = this.codigoHc.trim().toUpperCase();
    this.paciente = this.paciente.trim();
    this.propietario = this.propietario.trim();
    this.user = this.user.trim();
    this.observations = this.observations.trim();

    if (!Number.isInteger(this.caseNumber) || this.caseNumber < 1 || this.caseNumber > 100) {
      this.message.set('El numero de caso debe estar entre 1 y 100.');
      return false;
    }

    if (!this.user) {
      this.message.set('Ingresa el usuario que realiza la busqueda.');
      return false;
    }

    if (this.codigoHc && !/^HC-\d{6}$/.test(this.codigoHc)) {
      this.message.set('El codigo HC debe tener el formato HC-000001.');
      return false;
    }

    if (!this.codigoHc && !this.paciente && !this.propietario) {
      this.message.set('Ingresa al menos un dato del caso: codigo HC, paciente o propietario.');
      return false;
    }

    return true;
  }

  private resetForNextCase() {
    this.caseNumber = this.nextNumber();
    this.codigoHc = '';
    this.paciente = '';
    this.propietario = '';
    this.observations = '';
  }

  private nextNumber(): number {
    const used = new Set(this.loadMeasurements().map((item) => item.number));
    for (let i = 1; i <= 100; i++) {
      if (!used.has(i)) return i;
    }
    return Math.min(100, used.size + 1);
  }

  private resolveShift(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Manana';
    if (hour < 18) return 'Tarde';
    return 'Noche';
  }

  private loadMeasurements(): ThesisMeasurement[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadActive(): ActiveMeasurementDraft | null {
    try {
      const raw = localStorage.getItem(this.activeKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private persistMeasurements(value: ThesisMeasurement[]) {
    localStorage.setItem(this.storageKey, JSON.stringify(value));
  }

  private persistActive(value: ActiveMeasurementDraft) {
    localStorage.setItem(this.activeKey, JSON.stringify(value));
  }

  private clearActive() {
    this.active.set(null);
    localStorage.removeItem(this.activeKey);
  }

  private formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  }

  private buildInstructionSheet(workbook: any) {
    const sheet = workbook.addWorksheet('Instructivo', { views: [{ showGridLines: false }] });
    sheet.columns = [{ width: 28 }, { width: 90 }];
    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').value = 'INSTRUMENTO 5. FICHA DE REGISTRO DE TIEMPOS DE BUSQUEDA DE HISTORIAS CLINICAS';
    this.styleTitle(sheet.getCell('A1'));

    sheet.addRows([
      [],
      ['Variable dependiente:', 'Eficiencia en la gestion de historias clinicas'],
      ['Dimension:', 'Busqueda de historias clinicas'],
      ['Indicador:', 'Tiempo promedio de busqueda de historia clinica (ms)'],
      ['Tecnica:', 'Observacion sistematica con cronometraje'],
      ['Momento:', 'Postest con sistema web en produccion'],
      ['Casos validos:', '100 busquedas validas, o total alcanzable durante el periodo de aplicacion'],
      ['Unidad de analisis:', 'Tarea de busqueda ejecutada por el usuario'],
      ['Unidad de medida:', 'Milisegundos (ms)'],
      [],
      ['FORMULA DEL INDICADOR'],
      ['TPB = SUMA(ti) / n', 'Solo se incluyen busquedas con Resultado = Exito'],
      ['ti', 'Tiempo individual en milisegundos que toma localizar y validar la historia clinica'],
      ['n', 'Numero de busquedas exitosas registradas en el postest'],
      [],
      ['INSTRUCCIONES DE USO'],
      ['1.', 'Abra el sistema web en produccion e ingrese al modulo Historias Clinicas.'],
      ['2.', 'Antes de escribir o buscar, presione Iniciar medicion en el modulo temporal de tesis.'],
      ['3.', 'Realice la busqueda segun el criterio asignado.'],
      ['4.', 'Cuando valide visualmente que la historia clinica encontrada es correcta, marque Encontrado.'],
      ['5.', 'Si no se localiza el registro, marque Fallo. El caso queda registrado, pero no entra al TPB.'],
      ['6.', 'Al finalizar, exporte el archivo y revise la hoja Resumen.'],
      ['7.', 'No confundir este tiempo operativo con el tiempo tecnico de respuesta del servidor.']
    ]);
    this.styleInstructionSheet(sheet);
  }

  private buildPosttestSheet(workbook: any) {
    const sheet = workbook.addWorksheet('5B_Postest', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
    sheet.columns = [
      { width: 7 }, { width: 13 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 24 },
      { width: 16 }, { width: 24 }, { width: 24 }, { width: 28 }, { width: 14 }, { width: 14 },
      { width: 13 }, { width: 38 }
    ];
    sheet.mergeCells('A1:N1');
    sheet.getCell('A1').value = 'Tabla 5B. Registro de tiempos de busqueda - Fase postest (Sistema web)';
    this.styleTitle(sheet.getCell('A1'));
    sheet.getRow(3).values = ['No.', 'Fecha', 'Hora inicio', 'Hora fin', 'Turno', 'Usuario', 'Codigo HC', 'Paciente', 'Propietario', 'Criterio de busqueda', 'Tiempo (ms)', 'Tiempo (seg)', 'Resultado', 'Observaciones'];
    this.styleHeaderRow(sheet.getRow(3));

    for (let i = 1; i <= 100; i++) {
      const item = this.measurements().find((m) => m.number === i);
      const row = sheet.getRow(i + 3);
      row.values = [
        i,
        item?.date ?? '',
        item?.startTime ?? '',
        item?.endTime ?? '',
        item?.shift ?? '',
        item?.user ?? '',
        item?.codigoHc ?? '',
        item?.paciente ?? '',
        item?.propietario ?? '',
        item?.criterio ?? '',
        item?.timeMs ?? '',
        item ? { formula: `K${i + 3}/1000` } : '',
        item?.result ?? '',
        item?.observations ?? ''
      ];
      row.eachCell((cell: any) => this.styleBodyCell(cell));
      if (item?.result === 'Exito') row.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      if (item?.result === 'Fallo') row.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    }

    sheet.getColumn(11).numFmt = '#,##0';
    sheet.getColumn(12).numFmt = '0.000';
    sheet.autoFilter = 'A3:N103';
  }

  private buildSummarySheet(workbook: any) {
    const sheet = workbook.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
    sheet.columns = [{ width: 34 }, { width: 18 }, { width: 6 }, { width: 30 }, { width: 14 }, { width: 16 }];
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = 'Resumen del Instrumento 5 - Postest';
    this.styleTitle(sheet.getCell('A1'));

    const labels = [
      'Total de registros con tiempo', 'Busquedas exitosas (n)', 'Busquedas fallidas', 'TPB promedio (ms)',
      'TPB promedio (seg)', 'Tiempo minimo exitoso (ms)', 'Tiempo maximo exitoso (ms)', 'Mediana exitosa (ms)',
      'Porcentaje de exito'
    ];
    labels.forEach((label, index) => {
      const row = index + 3;
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FF' } };
      sheet.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF334155' } };
      this.styleBodyCell(sheet.getCell(`A${row}`));
      this.styleBodyCell(sheet.getCell(`B${row}`));
    });

    sheet.getCell('B3').value = { formula: 'COUNT(\'5B_Postest\'!K4:K103)' };
    sheet.getCell('B4').value = { formula: 'COUNTIF(\'5B_Postest\'!M4:M103,"Exito")' };
    sheet.getCell('B5').value = { formula: 'COUNTIF(\'5B_Postest\'!M4:M103,"Fallo")' };
    sheet.getCell('B6').value = { formula: 'IFERROR(AVERAGEIF(\'5B_Postest\'!M4:M103,"Exito",\'5B_Postest\'!K4:K103),0)' };
    sheet.getCell('B7').value = { formula: 'IFERROR(B6/1000,0)' };
    sheet.getCell('B8').value = { formula: 'IFERROR(MINIFS(\'5B_Postest\'!K4:K103,\'5B_Postest\'!M4:M103,"Exito"),0)' };
    sheet.getCell('B9').value = { formula: 'IFERROR(MAXIFS(\'5B_Postest\'!K4:K103,\'5B_Postest\'!M4:M103,"Exito"),0)' };
    sheet.getCell('B10').value = { formula: 'IFERROR(MEDIAN(FILTER(\'5B_Postest\'!K4:K103,\'5B_Postest\'!M4:M103="Exito")),0)' };
    sheet.getCell('B11').value = { formula: 'IFERROR(B4/B3,0)' };
    sheet.getCell('B7').numFmt = '0.000';
    sheet.getCell('B11').numFmt = '0.0%';

    sheet.getRow(3).getCell(4).value = 'Criterio de busqueda';
    sheet.getRow(3).getCell(5).value = 'Exitos';
    sheet.getRow(3).getCell(6).value = 'Promedio ms';
    this.styleHeaderRow(sheet.getRow(3), 4, 6);
    this.criteria.forEach((criterion, index) => {
      const row = index + 4;
      sheet.getCell(`D${row}`).value = criterion;
      sheet.getCell(`E${row}`).value = { formula: `COUNTIFS('5B_Postest'!J4:J103,D${row},'5B_Postest'!M4:M103,"Exito")` };
      sheet.getCell(`F${row}`).value = { formula: `IFERROR(AVERAGEIFS('5B_Postest'!K4:K103,'5B_Postest'!J4:J103,D${row},'5B_Postest'!M4:M103,"Exito"),0)` };
      ['D', 'E', 'F'].forEach((col) => this.styleBodyCell(sheet.getCell(`${col}${row}`)));
    });

    sheet.mergeCells('A13:F13');
    sheet.getCell('A13').value = 'Criterio metodologico';
    sheet.getCell('A13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FF' } };
    sheet.getCell('A13').font = { bold: true, color: { argb: 'FF004B80' } };
    const notes = [
      'El tiempo registrado corresponde al tiempo operativo del usuario: desde que inicia la busqueda hasta que localiza y valida visualmente la historia clinica.',
      'Solo los registros con Resultado = Exito se incluyen en el calculo del TPB.',
      'Las busquedas con Resultado = Fallo se conservan para control metodologico, pero no alteran el promedio.',
      'El modulo temporal de tesis exporta directamente a esta estructura.'
    ];
    notes.forEach((note, index) => {
      const row = index + 14;
      sheet.mergeCells(`A${row}:F${row}`);
      sheet.getCell(`A${row}`).value = note;
      sheet.getCell(`A${row}`).alignment = { wrapText: true, vertical: 'middle' };
    });
  }

  private buildListsSheet(workbook: any) {
    const sheet = workbook.addWorksheet('Listas', { state: 'hidden', views: [{ showGridLines: false }] });
    sheet.columns = [{ width: 20 }, { width: 30 }, { width: 14 }];
    sheet.addRows([
      ['Turno', 'Criterio', 'Resultado'],
      ['Manana', 'Por Codigo de Historia', 'Exito'],
      ['Tarde', 'Por Nombre de Mascota', 'Fallo'],
      ['Noche', 'Por Apellido Propietario', '']
    ]);
    this.styleHeaderRow(sheet.getRow(1), 1, 3);
  }

  private styleTitle(cell: any) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066AA' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
    cell.alignment = { vertical: 'middle', wrapText: true };
  }

  private styleHeaderRow(row: any, from = 1, to = row.cellCount || 14) {
    row.height = 30;
    for (let i = from; i <= to; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004B80' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = this.borderStyle();
    }
  }

  private styleBodyCell(cell: any) {
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = this.borderStyle();
  }

  private styleInstructionSheet(sheet: any) {
    for (let row = 3; row <= 25; row++) {
      sheet.getRow(row).eachCell((cell: any) => this.styleBodyCell(cell));
    }
    ['A3:A10', 'A13:A15', 'A18:A24'].forEach((range) => {
      sheet.getCell(range.split(':')[0]).font = { bold: true, color: { argb: 'FF334155' } };
    });
  }

  private borderStyle() {
    return {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  }
}
