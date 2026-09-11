import { Injectable } from '@angular/core';
import type jsPDF from 'jspdf';
import type ExcelJS from 'exceljs';
import { HeatmapItem, ItemCount, ItemMonto, ProximaAplicacion, ReportesClinicos } from '../../models/response/reportes-clinicos-response';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type ExportCell = string | number;

interface SeccionItemCount {
  titulo: string;
  items: ItemCount[];
}

interface SeccionProxima {
  titulo: string;
  items: ProximaAplicacion[];
}

interface SeccionItemMonto {
  titulo: string;
  items: ItemMonto[];
}

@Injectable()
export class ReportesExportService {

  private seccionesItemCount(reporte: ReportesClinicos): SeccionItemCount[] {
    return [
      { titulo: 'Estado de citas', items: reporte.consultasPorEstado },
      { titulo: 'Consultas por tipo', items: reporte.consultasPorTipo },
      { titulo: 'Pacientes por especie', items: reporte.pacientesPorEspecie },
      { titulo: 'Pacientes por rango de edad', items: reporte.pacientesPorRangoEdad },
      { titulo: 'Consultas por mes', items: reporte.consultasPorMes },
      { titulo: 'Consultas por veterinario', items: reporte.consultasPorVeterinario },
      { titulo: 'Frecuencia de consultas por paciente', items: reporte.frecuenciaConsultasPorPaciente },
      { titulo: 'Servicios más solicitados', items: reporte.serviciosMasSolicitados },
      { titulo: 'Cumplimiento de vacunación', items: reporte.cumplimientoVacunacion },
      { titulo: 'Cumplimiento de desparasitación', items: reporte.cumplimientoDesparasitacion },
    ].filter((seccion): seccion is SeccionItemCount => !!seccion.items?.length);
  }

  private seccionesItemMonto(reporte: ReportesClinicos): SeccionItemMonto[] {
    return [
      { titulo: 'Ingresos por método de pago', items: reporte.ingresosPorMetodoPago },
      { titulo: 'Ingresos por servicio', items: reporte.ingresosPorServicio },
    ].filter((seccion): seccion is SeccionItemMonto => !!seccion.items?.length);
  }

  private seccionesProximas(reporte: ReportesClinicos): SeccionProxima[] {
    return [
      { titulo: 'Próximas vacunas', items: reporte.proximasVacunas },
      { titulo: 'Próximas desparasitaciones', items: reporte.proximasDesparasitaciones },
      { titulo: 'Próximos controles preventivos', items: reporte.controlesPreventivosProximos },
    ].filter((seccion): seccion is SeccionProxima => !!seccion.items?.length);
  }

  private demandaPorHorarioFilas(items: HeatmapItem[] | null): { dia: string; hora: string; count: number }[] {
    return (items ?? [])
      .filter(item => item.count > 0)
      .sort((a, b) => a.diaSemana - b.diaSemana || a.hora - b.hora)
      .map(item => ({ dia: DIAS_SEMANA[item.diaSemana] ?? `Día ${item.diaSemana}`, hora: `${String(item.hora).padStart(2, '0')}:00`, count: item.count }));
  }

  async exportarPdf(reporte: ReportesClinicos): Promise<void> {
    const { default: JsPdf } = await import('jspdf');
    const doc = new JsPdf();
    const resumen = reporte.resumen;
    const margenInferior = 280;
    let y = 18;

    const asegurarEspacio = (alturaNecesaria: number) => {
      if (y + alturaNecesaria > margenInferior) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFontSize(18);
    doc.text('Reportes clínicos', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Periodo: ${reporte.fechaDesde} al ${reporte.fechaHasta}`, 14, y);
    doc.setTextColor(20);
    y += 10;

    doc.setFontSize(12);
    doc.text('Resumen', 14, y);
    y += 6;
    doc.setFontSize(9);
    [
      `Consultas: ${resumen.consultas}`,
      `Pacientes atendidos: ${resumen.pacientesAtendidos}`,
      resumen.ingresos != null ? `Ingresos: ${this.formatMoney(resumen.ingresos)}` : null,
      `Nuevos pacientes: ${resumen.nuevosPacientes}`,
      `Tiempo promedio de atención: ${resumen.tiempoPromedioAtencionMinutos} min`,
      `Citas completadas: ${resumen.porcentajeCitasCompletadas}%`
    ].filter((linea): linea is string => linea != null)
      .forEach(linea => { doc.text(linea, 18, y); y += 5.5; });
    y += 4;

    for (const seccion of this.seccionesItemCount(reporte)) {
      asegurarEspacio(14 + seccion.items.length * 5.5);
      y = this.addPdfItemCountSection(doc, seccion.titulo, seccion.items, y);
    }

    for (const seccion of this.seccionesItemMonto(reporte)) {
      asegurarEspacio(14 + seccion.items.length * 5.5);
      y = this.addPdfItemMontoSection(doc, seccion.titulo, seccion.items, y);
    }

    for (const seccion of this.seccionesProximas(reporte)) {
      asegurarEspacio(14 + seccion.items.length * 5.5);
      y = this.addPdfProximaSection(doc, seccion.titulo, seccion.items, y);
    }

    const demanda = this.demandaPorHorarioFilas(reporte.demandaPorHorario);
    if (demanda.length) {
      asegurarEspacio(14 + demanda.length * 5.5);
      doc.setFontSize(12);
      doc.text('Demanda por horario', 14, y);
      y += 6;
      doc.setFontSize(9);
      demanda.forEach(fila => {
        asegurarEspacio(5.5);
        doc.text(`${fila.dia} ${fila.hora}: ${fila.count}`, 18, y);
        y += 5.5;
      });
    }

    doc.save(`reporte-clinico-${reporte.fechaDesde}-${reporte.fechaHasta}.pdf`);
  }

  private addPdfItemCountSection(doc: jsPDF, title: string, items: ItemCount[], startY: number): number {
    let y = startY;
    doc.setFontSize(12);
    doc.text(title, 14, y);
    y += 6;
    doc.setFontSize(9);
    items.forEach(item => { doc.text(`${item.label}: ${item.count}`, 18, y); y += 5.5; });
    return y + 4;
  }

  private addPdfItemMontoSection(doc: jsPDF, title: string, items: ItemMonto[], startY: number): number {
    let y = startY;
    doc.setFontSize(12);
    doc.text(title, 14, y);
    y += 6;
    doc.setFontSize(9);
    items.forEach(item => { doc.text(`${item.label}: ${this.formatMoney(item.monto)}`, 18, y); y += 5.5; });
    return y + 4;
  }

  private addPdfProximaSection(doc: jsPDF, title: string, items: ProximaAplicacion[], startY: number): number {
    let y = startY;
    doc.setFontSize(12);
    doc.text(title, 14, y);
    y += 6;
    doc.setFontSize(9);
    items.forEach(item => {
      const detalle = item.tipoControl ? ` (${item.tipoControl})` : '';
      doc.text(`${item.mascota} — ${item.producto}${detalle}: ${item.fechaProxima}`, 18, y);
      y += 5.5;
    });
    return y + 4;
  }

  async exportarExcel(reporte: ReportesClinicos): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJSRuntime = (ExcelJSModule as any).default ?? ExcelJSModule;
    const workbook: ExcelJS.Workbook = new ExcelJSRuntime.Workbook();
    workbook.creator = 'VetSoft';
    workbook.created = new Date();

    const resumenSheet = workbook.addWorksheet('Resumen');
    resumenSheet.columns = [{ width: 32 }, { width: 20 }];
    resumenSheet.addRow(['Periodo', `${reporte.fechaDesde} al ${reporte.fechaHasta}`]).font = { bold: true };
    resumenSheet.addRow([]);
    const encabezadoResumen = resumenSheet.addRow(['Indicador', 'Valor']);
    encabezadoResumen.font = { bold: true };
    ([
      ['Consultas', reporte.resumen.consultas],
      ['Pacientes atendidos', reporte.resumen.pacientesAtendidos],
      reporte.resumen.ingresos != null ? ['Ingresos (S/)', reporte.resumen.ingresos] : null,
      ['Nuevos pacientes', reporte.resumen.nuevosPacientes],
      ['Tiempo promedio de atención (min)', reporte.resumen.tiempoPromedioAtencionMinutos],
      ['Citas completadas (%)', reporte.resumen.porcentajeCitasCompletadas],
    ] as (ExportCell[] | null)[]).filter((fila): fila is ExportCell[] => fila != null)
      .forEach(fila => resumenSheet.addRow(fila));

    for (const seccion of this.seccionesItemCount(reporte)) {
      const sheet = workbook.addWorksheet(this.nombreHoja(seccion.titulo));
      sheet.columns = [{ width: 36 }, { width: 14 }];
      sheet.addRow([seccion.titulo, 'Cantidad']).font = { bold: true };
      seccion.items.forEach(item => sheet.addRow([item.label, item.count]));
    }

    for (const seccion of this.seccionesItemMonto(reporte)) {
      const sheet = workbook.addWorksheet(this.nombreHoja(seccion.titulo));
      sheet.columns = [{ width: 36 }, { width: 16 }];
      sheet.addRow([seccion.titulo, 'Monto (S/)']).font = { bold: true };
      seccion.items.forEach(item => sheet.addRow([item.label, item.monto]));
    }

    for (const seccion of this.seccionesProximas(reporte)) {
      const sheet = workbook.addWorksheet(this.nombreHoja(seccion.titulo));
      sheet.columns = [{ width: 24 }, { width: 24 }, { width: 16 }, { width: 20 }];
      sheet.addRow(['Mascota', 'Producto', 'Fecha próxima', 'Tipo de control']).font = { bold: true };
      seccion.items.forEach(item => sheet.addRow([item.mascota, item.producto, item.fechaProxima, item.tipoControl ?? '']));
    }

    const demanda = this.demandaPorHorarioFilas(reporte.demandaPorHorario);
    if (demanda.length) {
      const sheet = workbook.addWorksheet('Demanda por horario');
      sheet.columns = [{ width: 14 }, { width: 10 }, { width: 12 }];
      sheet.addRow(['Día', 'Hora', 'Cantidad']).font = { bold: true };
      demanda.forEach(fila => sheet.addRow([fila.dia, fila.hora, fila.count]));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-clinico-${reporte.fechaDesde}-${reporte.fechaHasta}.xlsx`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  private nombreHoja(titulo: string): string {
    // Excel prohíbe : \ / ? * [ ] en nombres de hoja y los limita a 31 caracteres
    return titulo.replace(/[:\\/?*[\]]/g, '').slice(0, 31);
  }

  private formatMoney(value: number | null): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(value ?? 0);
  }
}
