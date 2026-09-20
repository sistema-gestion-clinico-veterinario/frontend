import { Injectable, inject } from '@angular/core';
import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import type ExcelJS from 'exceljs';
import { HeatmapItem, ItemCount, ItemMonto, ProximaAplicacion, ReportesClinicos } from '../../models/response/reportes-clinicos-response';
import { CompanyDTO } from '../../models/request/company-dto';
import { AuditLogService } from '../../core/services/audit-log.service';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const PRIMARY: [number, number, number] = [0, 102, 170];
const TEXT_MUTED: [number, number, number] = [100, 112, 138];
const TEXT_DARK: [number, number, number] = [30, 41, 59];
const SUCCESS: [number, number, number] = [34, 160, 107];
const DANGER: [number, number, number] = [220, 38, 38];
const BORDER: [number, number, number] = [226, 232, 240];

export interface ReportChartImage {
  dataUrl: string;
  width: number;
  height: number;
}

type ExportCell = string | number;

interface SeccionBase {
  titulo: string;
  chart?: string;
}

interface SeccionItemCount extends SeccionBase {
  tipo: 'count';
  items: ItemCount[];
}

interface SeccionItemMonto extends SeccionBase {
  tipo: 'monto';
  items: ItemMonto[];
}

type SeccionRenderable = SeccionItemCount | SeccionItemMonto;

interface SeccionProxima {
  titulo: string;
  items: ProximaAplicacion[];
}

@Injectable()
export class ReportesExportService {

  private readonly auditLogService = inject(AuditLogService);

  private seccionesRenderables(reporte: ReportesClinicos): SeccionRenderable[] {
    const countSecciones: { titulo: string; items: ItemCount[] | null; chart?: string }[] = [
      { titulo: 'Estado de citas', items: reporte.consultasPorEstado, chart: 'estados' },
      { titulo: 'Consultas por tipo', items: reporte.consultasPorTipo },
      { titulo: 'Pacientes por especie', items: reporte.pacientesPorEspecie, chart: 'especies' },
      { titulo: 'Pacientes por rango de edad', items: reporte.pacientesPorRangoEdad, chart: 'edades' },
      { titulo: 'Evolución de consultas', items: reporte.consultasPorMes, chart: 'evolucion' },
      { titulo: 'Consultas por empleado', items: reporte.consultasPorVeterinario, chart: 'veterinarios' },
      { titulo: 'Frecuencia de consultas por paciente', items: reporte.frecuenciaConsultasPorPaciente, chart: 'frecuencia' },
      { titulo: 'Servicios más solicitados', items: reporte.serviciosMasSolicitados, chart: 'servicios' },
      { titulo: 'Cumplimiento de vacunación', items: reporte.cumplimientoVacunacion, chart: 'cumplimientoVacunacion' },
      { titulo: 'Cumplimiento de desparasitación', items: reporte.cumplimientoDesparasitacion, chart: 'cumplimientoDesparasitacion' },
    ];
    const montoSecciones: { titulo: string; items: ItemMonto[] | null; chart?: string }[] = [
      { titulo: 'Ingresos por método de pago', items: reporte.ingresosPorMetodoPago, chart: 'ingresosMetodo' },
      { titulo: 'Ingresos por servicio', items: reporte.ingresosPorServicio, chart: 'ingresosServicio' },
    ];

    const counts: SeccionRenderable[] = countSecciones
      .filter((s): s is { titulo: string; items: ItemCount[]; chart?: string } => !!s.items?.length)
      .map(s => ({ tipo: 'count', titulo: s.titulo, items: s.items, chart: s.chart }));
    const montos: SeccionRenderable[] = montoSecciones
      .filter((s): s is { titulo: string; items: ItemMonto[]; chart?: string } => !!s.items?.length)
      .map(s => ({ tipo: 'monto', titulo: s.titulo, items: s.items, chart: s.chart }));

    return [...counts, ...montos];
  }

  private seccionesProximas(reporte: ReportesClinicos): SeccionProxima[] {
    const secciones: { titulo: string; items: ProximaAplicacion[] | null }[] = [
      { titulo: 'Próximas vacunas', items: reporte.proximasVacunas },
      { titulo: 'Próximas desparasitaciones', items: reporte.proximasDesparasitaciones },
      { titulo: 'Próximos controles preventivos', items: reporte.controlesPreventivosProximos },
    ];
    return secciones.filter((seccion): seccion is SeccionProxima => !!seccion.items?.length);
  }

  private demandaPorHorarioFilas(items: HeatmapItem[] | null): { dia: string; hora: string; count: number }[] {
    return (items ?? [])
      .filter(item => item.count > 0)
      .sort((a, b) => a.diaSemana - b.diaSemana || a.hora - b.hora)
      .map(item => ({ dia: DIAS_SEMANA[item.diaSemana] ?? `Día ${item.diaSemana}`, hora: `${String(item.hora).padStart(2, '0')}:00`, count: item.count }));
  }

  private humanizar(valor: string | null | undefined): string {
    if (!valor) return '';
    const normalizado = valor.replace(/_/g, ' ').toLowerCase();
    return normalizado.charAt(0).toUpperCase() + normalizado.slice(1);
  }

  async exportarPdf(
    reporte: ReportesClinicos,
    chartImages: Map<string, ReportChartImage> = new Map(),
    empresa: CompanyDTO | null = null,
    logoDataUrl: string | null = null
  ): Promise<void> {
    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new JsPdf();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const marginTop = 16;
    const marginBottom = 16;
    const contentWidth = pageWidth - marginX * 2;
    const margenInferior = pageHeight - marginBottom;
    let y = 0;

    const tableOptions = (extra: UserOptions): UserOptions => ({
      theme: 'striped',
      margin: { left: marginX, right: marginX, top: marginTop, bottom: marginBottom },
      styles: { font: 'helvetica', fontSize: 9, textColor: TEXT_DARK, lineColor: BORDER, lineWidth: 0.1 },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      ...extra
    });

    const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Pura a propósito (recibe y, devuelve el y correcto) en vez de mutar una variable
    // por closure: una función que recibe "y" como parámetro nunca ve una mutación externa
    // (los números se pasan por valor), así que si esto mutara `y` de afuera, cualquier
    // función que ya tuviera su propia copia de `y` seguiría dibujando en la posición vieja
    // tras el salto de página - exactamente el bug que dejaba páginas en blanco.
    const asegurarEspacio = (yActual: number, alturaNecesaria: number): number => {
      if (yActual + alturaNecesaria > margenInferior) {
        doc.addPage();
        return marginTop;
      }
      return yActual;
    };

    // Encabezado: logo y datos de la empresa (sin banda de color, solo texto)
    let textoX = marginX;
    let logoAlto = 0;
    if (logoDataUrl) {
      try {
        // Respetar la proporción real del logo (getImageProperties lee las dimensiones
        // reales del PNG/JPEG) en vez de forzarlo a un cuadro fijo, que lo deja estirado.
        const props = doc.getImageProperties(logoDataUrl);
        const maxAncho = 20;
        const maxAlto = 18;
        let ancho = maxAncho;
        let alto = (ancho * props.height) / props.width;
        if (alto > maxAlto) {
          alto = maxAlto;
          ancho = (alto * props.width) / props.height;
        }
        doc.addImage(logoDataUrl, marginX, 10, ancho, alto);
        textoX = marginX + ancho + 6;
        logoAlto = alto;
      } catch {
        // Si el logo no se pudo decodificar, se omite sin bloquear el resto del PDF
      }
    }
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa?.name ?? 'Reportes clínicos', textoX, 16);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    const detalle = [empresa?.address, empresa?.phone, empresa?.email].filter(Boolean).join('   ·   ');
    if (detalle) doc.text(detalle, textoX, 21.5);
    if (empresa?.ruc) doc.text(`RUC: ${empresa.ruc}`, textoX, 26);

    y = Math.max(10 + logoAlto, 30) + 4;
    doc.setDrawColor(...BORDER);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;

    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Reportes clínicos', marginX, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Periodo: ${reporte.fechaDesde} al ${reporte.fechaHasta}`, marginX, y);
    doc.setTextColor(...TEXT_DARK);
    y += 8;

    // Tarjetas de resumen (KPIs), igual que en pantalla
    const resumen = reporte.resumen;
    const anterior = reporte.resumenAnterior;
    const variacion = (actual: number, previo: number): number | null => previo === 0 ? null : ((actual - previo) / previo) * 100;
    const variacionTexto = (actual: number, previo: number): string => {
      const v = variacion(actual, previo);
      if (v == null) return 'Sin datos del periodo anterior';
      const signo = v >= 0 ? '+' : '';
      return `${signo}${v.toFixed(1)}% vs. periodo anterior`;
    };
    const kpis: { label: string; value: string; variacion?: string; negativa?: boolean }[] = [
      { label: 'Consultas del periodo', value: `${resumen.consultas}`, variacion: variacionTexto(resumen.consultas, anterior.consultas), negativa: (variacion(resumen.consultas, anterior.consultas) ?? 0) < 0 },
      { label: 'Pacientes atendidos', value: `${resumen.pacientesAtendidos}`, variacion: variacionTexto(resumen.pacientesAtendidos, anterior.pacientesAtendidos), negativa: (variacion(resumen.pacientesAtendidos, anterior.pacientesAtendidos) ?? 0) < 0 },
      ...(resumen.ingresos != null ? [{ label: 'Ingresos', value: this.formatMoney(resumen.ingresos), variacion: variacionTexto(resumen.ingresos, anterior.ingresos ?? 0), negativa: (variacion(resumen.ingresos, anterior.ingresos ?? 0) ?? 0) < 0 }] : []),
      { label: 'Nuevos pacientes', value: `${resumen.nuevosPacientes}`, variacion: variacionTexto(resumen.nuevosPacientes, anterior.nuevosPacientes), negativa: (variacion(resumen.nuevosPacientes, anterior.nuevosPacientes) ?? 0) < 0 },
      { label: 'Tiempo promedio de atención', value: `${resumen.tiempoPromedioAtencionMinutos} min` },
      { label: 'Citas completadas', value: `${resumen.porcentajeCitasCompletadas.toFixed(1)}%`, variacion: variacionTexto(resumen.porcentajeCitasCompletadas, anterior.porcentajeCitasCompletadas), negativa: (variacion(resumen.porcentajeCitasCompletadas, anterior.porcentajeCitasCompletadas) ?? 0) < 0 },
    ];
    y = this.drawKpiCards(doc, kpis, marginX, y, contentWidth);
    y += 6;

    // Gráficos emparejados de a dos por fila (más denso, menos hojas y menos espacio vacío)
    // y tablas a ancho completo. pendiente guarda un gráfico impar esperando su par.
    let pendiente: { titulo: string; imagen: ReportChartImage } | null = null;
    const flushPendiente = () => {
      if (!pendiente) return;
      y = this.drawChartRow(doc, [pendiente], marginX, y, contentWidth, asegurarEspacio);
      pendiente = null;
    };

    for (const seccion of this.seccionesRenderables(reporte)) {
      const imagen = seccion.chart ? chartImages.get(seccion.chart) : undefined;
      if (imagen) {
        if (pendiente) {
          y = this.drawChartRow(doc, [pendiente, { titulo: seccion.titulo, imagen }], marginX, y, contentWidth, asegurarEspacio);
          pendiente = null;
        } else {
          pendiente = { titulo: seccion.titulo, imagen };
        }
        continue;
      }

      flushPendiente();
      y = asegurarEspacio(y, 20);
      y = this.drawSectionTitle(doc, seccion.titulo, marginX, y);
      if (seccion.tipo === 'count') {
        autoTable(doc, tableOptions({
          startY: y,
          head: [[seccion.titulo, 'Cantidad']],
          body: seccion.items.map(item => [item.label, `${item.count}`]),
          columnStyles: { 1: { halign: 'right', cellWidth: 30 } }
        }));
      } else {
        autoTable(doc, tableOptions({
          startY: y,
          head: [[seccion.titulo, 'Monto']],
          body: seccion.items.map(item => [item.label, this.formatMoney(item.monto)]),
          columnStyles: { 1: { halign: 'right', cellWidth: 30 } }
        }));
      }
      y = finalY() + 8;
    }
    flushPendiente();

    for (const seccion of this.seccionesProximas(reporte)) {
      y = asegurarEspacio(y, 20);
      y = this.drawSectionTitle(doc, seccion.titulo, marginX, y);
      autoTable(doc, tableOptions({
        startY: y,
        head: [['Mascota', 'Producto', 'Tipo', 'Fecha próxima']],
        body: seccion.items.map(item => [item.mascota, item.producto, this.humanizar(item.tipoControl), item.fechaProxima])
      }));
      y = finalY() + 8;
    }

    const demanda = this.demandaPorHorarioFilas(reporte.demandaPorHorario);
    if (demanda.length) {
      y = asegurarEspacio(y, 20);
      y = this.drawSectionTitle(doc, 'Horarios con mayor demanda', marginX, y);
      autoTable(doc, tableOptions({
        startY: y,
        head: [['Día', 'Hora', 'Citas']],
        body: demanda.map(fila => [fila.dia, fila.hora, `${fila.count}`]),
        columnStyles: { 2: { halign: 'right', cellWidth: 30 } }
      }));
    }

    doc.save(`reporte-clinico-${reporte.fechaDesde}-${reporte.fechaHasta}.pdf`);
    this.auditLogService.registrarDescarga('REPORTE_CLINICO_PDF', `${reporte.fechaDesde} a ${reporte.fechaHasta}`).subscribe();
  }

  private drawSectionTitle(doc: jsPDF, titulo: string, x: number, y: number): number {
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, x, y);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont('helvetica', 'normal');
    return y + 6;
  }

  private drawKpiCards(
    doc: jsPDF,
    kpis: { label: string; value: string; variacion?: string; negativa?: boolean }[],
    x: number,
    y: number,
    contentWidth: number
  ): number {
    const cols = 3;
    const gap = 4;
    const cardWidth = (contentWidth - gap * (cols - 1)) / cols;
    const cardHeight = 22;
    let cursorY = y;

    kpis.forEach((kpi, index) => {
      const col = index % cols;
      if (col === 0 && index > 0) cursorY += cardHeight + gap;
      const cardX = x + col * (cardWidth + gap);

      doc.setDrawColor(...BORDER);
      doc.setFillColor(250, 250, 251);
      doc.roundedRect(cardX, cursorY, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setTextColor(...TEXT_MUTED);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, cardX + 4, cursorY + 7);

      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, cardX + 4, cursorY + 15);

      if (kpi.variacion) {
        doc.setTextColor(...(kpi.negativa ? DANGER : SUCCESS));
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(kpi.variacion, cardX + 4, cursorY + 19.5);
      }
    });

    doc.setTextColor(...TEXT_DARK);
    return cursorY + cardHeight;
  }

  /** Dibuja 1 o 2 gráficos lado a lado (misma fila) para aprovechar mejor el espacio de la hoja. */
  private drawChartRow(
    doc: jsPDF,
    entradas: { titulo: string; imagen: ReportChartImage }[],
    x: number,
    y: number,
    contentWidth: number,
    asegurarEspacio: (yActual: number, altura: number) => number
  ): number {
    const gap = 6;
    const cols = entradas.length;
    const colWidth = cols === 2 ? (contentWidth - gap) / 2 : contentWidth;
    const maxHeight = 60;

    const medidas = entradas.map(entrada => {
      const aspecto = entrada.imagen.width / entrada.imagen.height;
      let ancho = colWidth;
      let alto = ancho / aspecto;
      if (alto > maxHeight) {
        alto = maxHeight;
        ancho = alto * aspecto;
      }
      return { ancho, alto };
    });
    const filaAlto = Math.max(...medidas.map(m => m.alto));

    y = asegurarEspacio(y, filaAlto + 14);
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    entradas.forEach((entrada, index) => {
      const colX = x + index * (colWidth + gap);
      doc.text(entrada.titulo, colX, y);
    });
    doc.setTextColor(...TEXT_DARK);
    doc.setFont('helvetica', 'normal');
    y += 6;

    entradas.forEach((entrada, index) => {
      const colX = x + index * (colWidth + gap);
      const { ancho, alto } = medidas[index];
      const offsetX = colX + (colWidth - ancho) / 2;
      const offsetY = y + (filaAlto - alto) / 2;
      doc.addImage(entrada.imagen.dataUrl, 'PNG', offsetX, offsetY, ancho, alto);
    });

    return y + filaAlto + 8;
  }

  async exportarExcel(reporte: ReportesClinicos, empresa: CompanyDTO | null = null, logoDataUrl: string | null = null): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJSRuntime = (ExcelJSModule as any).default ?? ExcelJSModule;
    const workbook: ExcelJS.Workbook = new ExcelJSRuntime.Workbook();
    workbook.creator = empresa?.name ?? 'VetSoft';
    workbook.created = new Date();

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066AA' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const estiloEncabezado = (row: ExcelJS.Row) => {
      row.eachCell(cell => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle' };
      });
    };
    const estiloFilas = (sheet: ExcelJS.Worksheet, desdeFila: number) => {
      for (let i = desdeFila; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const esPar = (i - desdeFila) % 2 === 1;
        row.eachCell(cell => {
          cell.border = thinBorder;
          if (esPar) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    };

    const resumenSheet = workbook.addWorksheet('Resumen');
    resumenSheet.columns = [{ width: 32 }, { width: 20 }];
    if (empresa?.name) {
      const tieneLogo = !!logoDataUrl;
      if (tieneLogo) {
        const match = /^data:image\/(png|jpeg|gif);base64,(.+)$/.exec(logoDataUrl!);
        if (match) {
          const imageId = workbook.addImage({ extension: match[1] as 'png' | 'jpeg' | 'gif', base64: match[2] });
          // Respetar la proporción real del logo (ExcelJS no la infiere solo): un logo no
          // cuadrado forzado a 50x50 se ve estirado.
          const dimensiones = await this.dimensionesImagen(logoDataUrl!);
          const maxLado = 50;
          let ancho = maxLado;
          let alto = dimensiones ? (maxLado * dimensiones.height) / dimensiones.width : maxLado;
          if (alto > maxLado) {
            alto = maxLado;
            ancho = dimensiones ? (maxLado * dimensiones.width) / dimensiones.height : maxLado;
          }
          resumenSheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: ancho, height: alto } });
        }
      }
      const celdaTexto = tieneLogo ? 'B' : 'A';
      resumenSheet.getCell(`${celdaTexto}1`).value = empresa.name;
      resumenSheet.getCell(`${celdaTexto}1`).font = { bold: true, size: 14, color: { argb: 'FF0066AA' } };
      const detalle = [empresa.address, empresa.phone, empresa.email].filter(Boolean).join('   ·   ');
      if (detalle) {
        resumenSheet.getCell(`${celdaTexto}2`).value = detalle;
        resumenSheet.getCell(`${celdaTexto}2`).font = { color: { argb: 'FF64748B' } };
      }
      if (empresa.ruc) {
        resumenSheet.getCell(`${celdaTexto}3`).value = `RUC: ${empresa.ruc}`;
        resumenSheet.getCell(`${celdaTexto}3`).font = { color: { argb: 'FF64748B' } };
      }
      resumenSheet.addRow([]);
    }
    const filaTitulo = resumenSheet.addRow(['Reportes clínicos']);
    filaTitulo.font = { bold: true, size: 14, color: { argb: 'FF0066AA' } };
    resumenSheet.addRow([`Periodo: ${reporte.fechaDesde} al ${reporte.fechaHasta}`]).font = { italic: true, color: { argb: 'FF64748B' } };
    resumenSheet.addRow([]);
    estiloEncabezado(resumenSheet.addRow(['Indicador', 'Valor']));
    const filaIndicadorInicio = resumenSheet.rowCount + 1;
    ([
      ['Consultas', reporte.resumen.consultas],
      ['Pacientes atendidos', reporte.resumen.pacientesAtendidos],
      reporte.resumen.ingresos != null ? ['Ingresos (S/)', reporte.resumen.ingresos] : null,
      ['Nuevos pacientes', reporte.resumen.nuevosPacientes],
      ['Tiempo promedio de atención (min)', reporte.resumen.tiempoPromedioAtencionMinutos],
      ['Citas completadas (%)', reporte.resumen.porcentajeCitasCompletadas],
    ] as (ExportCell[] | null)[]).filter((fila): fila is ExportCell[] => fila != null)
      .forEach(fila => resumenSheet.addRow(fila));
    estiloFilas(resumenSheet, filaIndicadorInicio);

    for (const seccion of this.seccionesRenderables(reporte)) {
      const sheet = workbook.addWorksheet(this.nombreHoja(seccion.titulo));
      if (seccion.tipo === 'count') {
        sheet.columns = [{ width: 36 }, { width: 14 }];
        estiloEncabezado(sheet.addRow([seccion.titulo, 'Cantidad']));
        seccion.items.forEach(item => sheet.addRow([item.label, item.count]));
      } else {
        sheet.columns = [{ width: 36 }, { width: 16 }];
        estiloEncabezado(sheet.addRow([seccion.titulo, 'Monto (S/)']));
        seccion.items.forEach(item => {
          const row = sheet.addRow([item.label, item.monto]);
          row.getCell(2).numFmt = '#,##0.00';
        });
      }
      estiloFilas(sheet, 2);
    }

    for (const seccion of this.seccionesProximas(reporte)) {
      const sheet = workbook.addWorksheet(this.nombreHoja(seccion.titulo));
      sheet.columns = [{ width: 24 }, { width: 24 }, { width: 20 }, { width: 16 }];
      estiloEncabezado(sheet.addRow(['Mascota', 'Producto', 'Tipo de control', 'Fecha próxima']));
      seccion.items.forEach(item => sheet.addRow([item.mascota, item.producto, this.humanizar(item.tipoControl), item.fechaProxima]));
      estiloFilas(sheet, 2);
    }

    const demanda = this.demandaPorHorarioFilas(reporte.demandaPorHorario);
    if (demanda.length) {
      const sheet = workbook.addWorksheet('Demanda por horario');
      sheet.columns = [{ width: 14 }, { width: 10 }, { width: 12 }];
      estiloEncabezado(sheet.addRow(['Día', 'Hora', 'Cantidad']));
      demanda.forEach(fila => sheet.addRow([fila.dia, fila.hora, fila.count]));
      estiloFilas(sheet, 2);
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
    this.auditLogService.registrarDescarga('REPORTE_CLINICO_EXCEL', `${reporte.fechaDesde} a ${reporte.fechaHasta}`).subscribe();
  }

  private dimensionesImagen(dataUrl: string): Promise<{ width: number; height: number } | null> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
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
