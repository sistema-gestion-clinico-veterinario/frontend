import { Injectable } from '@angular/core';
import type jsPDF from 'jspdf';
import { ItemCount, ReportesClinicos } from '../../models/response/reportes-clinicos-response';

type ExportCell = string | number;

@Injectable()
export class ReportesExportService {

  async exportarPdf(reporte: ReportesClinicos): Promise<void> {
    const { default: JsPdf } = await import('jspdf');
    const doc = new JsPdf();
    const resumen = reporte.resumen;

    doc.setFontSize(18);
    doc.text('Reportes clínicos', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Periodo: ${reporte.fechaDesde} al ${reporte.fechaHasta}`, 14, 26);
    doc.setTextColor(20);

    [
      `Consultas: ${resumen.consultas}`,
      `Pacientes atendidos: ${resumen.pacientesAtendidos}`,
      `Ingresos: ${this.formatMoney(resumen.ingresos)}`,
      `Nuevos pacientes: ${resumen.nuevosPacientes}`,
      `Tiempo promedio de atención: ${resumen.tiempoPromedioAtencionMinutos} min`,
      `Citas completadas: ${resumen.porcentajeCitasCompletadas}%`
    ].forEach((linea, index) => doc.text(linea, 14, 40 + index * 8));

    this.addPdfSection(doc, 'Estado de citas', reporte.consultasPorEstado, 94);
    this.addPdfSection(doc, 'Servicios más solicitados', reporte.serviciosMasSolicitados, 140);
    doc.save(`reporte-clinico-${reporte.fechaDesde}-${reporte.fechaHasta}.pdf`);
  }

  exportarExcel(reporte: ReportesClinicos): void {
    const rows: ExportCell[][] = [
      ['REPORTE CLÍNICO', ''],
      ['Periodo', `${reporte.fechaDesde} al ${reporte.fechaHasta}`],
      ['Consultas', reporte.resumen.consultas],
      ['Pacientes atendidos', reporte.resumen.pacientesAtendidos],
      ['Ingresos', reporte.resumen.ingresos],
      ['Nuevos pacientes', reporte.resumen.nuevosPacientes],
      ['Tiempo promedio (min)', reporte.resumen.tiempoPromedioAtencionMinutos],
      ['Citas completadas (%)', reporte.resumen.porcentajeCitasCompletadas],
      [],
      ['ESTADO DE CITAS', 'CANTIDAD'],
      ...reporte.consultasPorEstado.map(item => [item.label, item.count] satisfies ExportCell[]),
      [],
      ['SERVICIOS MÁS SOLICITADOS', 'CANTIDAD'],
      ...reporte.serviciosMasSolicitados.map(item => [item.label, item.count] satisfies ExportCell[])
    ];

    const html = `<table>${rows.map(row =>
      `<tr>${row.map(cell => `<td>${this.escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`
    ).join('')}</table>`;
    const blob = new Blob(['\ufeff', html], {
      type: 'application/vnd.ms-excel;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-clinico-${reporte.fechaDesde}-${reporte.fechaHasta}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(value ?? 0);
  }

  private addPdfSection(doc: jsPDF, title: string, items: ItemCount[], startY: number): void {
    doc.setFontSize(12);
    doc.text(title, 14, startY);
    doc.setFontSize(9);
    items.slice(0, 8).forEach((item, index) =>
      doc.text(`${item.label}: ${item.count}`, 18, startY + 8 + index * 6)
    );
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!)
    );
  }
}
