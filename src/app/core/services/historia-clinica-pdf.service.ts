import { Injectable, inject } from '@angular/core';
import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { AuditLogService } from './audit-log.service';
import { formatearFechaClinica } from '../../shared/utils/fecha-clinica.util';
import { HistoriaClinicaDetalle, ConsultaResumen } from '../../models/response/historia-clinica-response';

const PRIMARY: [number, number, number] = [0, 102, 170];
const TEXT_MUTED: [number, number, number] = [90, 90, 90];
const TEXT_DARK: [number, number, number] = [20, 20, 20];
const BORDER: [number, number, number] = [180, 180, 180];
const HEAD_FILL: [number, number, number] = [242, 242, 242];

const TIPO_CONSULTA_LABEL: Record<string, string> = {
  CONSULTA_GENERAL: 'Consulta general', URGENCIA: 'Urgencia', CONTROL: 'Control',
  CIRUGIA: 'Cirugía', VACUNACION: 'Vacunación', DESPARASITACION: 'Desparasitación'
};

export interface EncabezadoEmpresaPdf {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  ruc?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HistoriaClinicaPdfService {
  private readonly auditLogService = inject(AuditLogService);

  async generarPdf(
    hc: HistoriaClinicaDetalle,
    empresa: EncabezadoEmpresaPdf | null = null,
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
    const marginBottom = 20;
    const contentWidth = pageWidth - marginX * 2;
    const margenInferior = pageHeight - marginBottom;

    const tableOptions = (extra: UserOptions): UserOptions => ({
      theme: 'grid',
      margin: { left: marginX, right: marginX, top: marginTop, bottom: marginBottom },
      styles: { font: 'helvetica', fontSize: 8.5, textColor: TEXT_DARK, lineColor: BORDER, lineWidth: 0.2 },
      headStyles: { fillColor: HEAD_FILL, textColor: TEXT_DARK, fontStyle: 'bold', fontSize: 7.5, lineColor: BORDER, lineWidth: 0.2 },
      ...extra
    });

    const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    const asegurarEspacio = (yActual: number, alturaNecesaria: number): number => {
      if (yActual + alturaNecesaria > margenInferior) {
        doc.addPage();
        return marginTop;
      }
      return yActual;
    };

    const etiquetaSeccion = (texto: string, yActual: number): number => {
      const y = asegurarEspacio(yActual, 10);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT_MUTED);
      doc.text(texto.toUpperCase(), marginX, y);
      doc.setTextColor(...TEXT_DARK);
      return y + 4;
    };

    let textoX = marginX;
    let logoAlto = 0;
    if (logoDataUrl) {
      try {
        const props = doc.getImageProperties(logoDataUrl);
        const maxAncho = 18;
        const maxAlto = 16;
        let ancho = maxAncho;
        let alto = (ancho * props.height) / props.width;
        if (alto > maxAlto) {
          alto = maxAlto;
          ancho = (alto * props.width) / props.height;
        }
        doc.addImage(logoDataUrl, marginX, 10, ancho, alto);
        textoX = marginX + ancho + 6;
        logoAlto = alto;
      } catch {}
    }
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa?.name || 'Clínica veterinaria', textoX, 16);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    const detalle = [empresa?.address, empresa?.phone, empresa?.email].filter(Boolean).join('   ·   ');
    if (detalle) doc.text(detalle, textoX, 21.5);
    if (empresa?.ruc) doc.text(`RUC: ${empresa.ruc}`, textoX, 26);

    let y = Math.max(10 + logoAlto, 30) + 6;
    doc.setDrawColor(...TEXT_DARK);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setLineWidth(0.2);
    y += 1.2;
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 10;

    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTORIA CLÍNICA', pageWidth / 2, y, { align: 'center' });
    y += 5.5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Registro completo de atenciones médicas', pageWidth / 2, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_DARK);
    y += 8;

    const datos: [string, string][] = [
      ['Mascota', hc.mascotaNombre],
      ['Especie / Raza', `${hc.especie ?? '—'} / ${hc.raza ?? '—'}`],
      ['Sexo', hc.sexo ?? '—'],
      ['Propietario', hc.propietarioNombre ?? '—'],
      ['N.° de historia clínica', hc.numeroHc],
      ['Total de atenciones', `${hc.consultas.length}`],
    ];
    const columnas = 3;
    const filaAltura = 15;
    const paddingSuperior = 9;
    const paddingInferior = 8;
    const numFilas = Math.ceil(datos.length / columnas);
    const fichaAlto = paddingSuperior + (numFilas - 1) * filaAltura + paddingInferior;

    doc.setFillColor(...HEAD_FILL);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginX, y, contentWidth, fichaAlto, 1.5, 1.5, 'FD');
    datos.forEach(([label, valor], index) => {
      const col = index % columnas;
      const fila = Math.floor(index / columnas);
      const colX = marginX + 6 + col * (contentWidth / columnas);
      const filaY = y + paddingSuperior + fila * filaAltura;
      doc.setTextColor(...TEXT_MUTED);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), colX, filaY);
      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(11.5);
      doc.setFont('helvetica', 'normal');
      doc.text(valor, colX, filaY + 5.5);
    });
    y += fichaAlto + 10;

    if (hc.consultas.length === 0) {
      y = asegurarEspacio(y, 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_MUTED);
      doc.text('Esta mascota aún no tiene atenciones registradas.', marginX, y);
    }

    hc.consultas.forEach((consulta, index) => {
      y = this.dibujarConsulta(doc, autoTable, tableOptions, asegurarEspacio, etiquetaSeccion, finalY, consulta, index, marginX, contentWidth, pageWidth, y);
      if (index < hc.consultas.length - 1) {
        y = asegurarEspacio(y, 6);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.2);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 8;
      }
    });

    const totalPaginas = doc.getNumberOfPages();
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      doc.setPage(pagina);
      const pieY = pageHeight - 10;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(marginX, pieY - 4, pageWidth - marginX, pieY - 4);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_MUTED);
      doc.text('Documento generado automáticamente — uso clínico confidencial', marginX, pieY);
      doc.text(`Página ${pagina} de ${totalPaginas}`, pageWidth - marginX, pieY, { align: 'right' });
    }

    const nombreArchivo = hc.mascotaNombre.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '-') || 'mascota';
    doc.save(`historia-clinica-${nombreArchivo}.pdf`);
    this.auditLogService.registrarDescarga('HISTORIA_CLINICA_PDF', hc.mascotaNombre).subscribe();
  }

  private dibujarConsulta(
    doc: jsPDF,
    autoTable: (d: jsPDF, options: UserOptions) => void,
    tableOptions: (extra: UserOptions) => UserOptions,
    asegurarEspacio: (yActual: number, altura: number) => number,
    etiquetaSeccion: (texto: string, yActual: number) => number,
    finalY: () => number,
    consulta: ConsultaResumen,
    index: number,
    marginX: number,
    contentWidth: number,
    pageWidth: number,
    yInicial: number
  ): number {
    let y = asegurarEspacio(yInicial, 22);

    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY);
    doc.text(`ATENCIÓN N.° ${index + 1}`, marginX, y);
    const tipoLabel = TIPO_CONSULTA_LABEL[consulta.tipoConsulta] ?? consulta.tipoConsulta;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${formatearFechaClinica(consulta.fechaConsulta)} · ${tipoLabel}`, pageWidth - marginX, y, { align: 'right' });
    y += 3;

    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setTextColor(...TEXT_DARK);
    y += 6;

    if (consulta.veterinarioNombre) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`Veterinario responsable: ${consulta.veterinarioNombre}`, marginX, y);
      doc.setTextColor(...TEXT_DARK);
      y += 6;
    }

    const escribirTexto = (etiqueta: string, texto: string): void => {
      y = etiquetaSeccion(etiqueta, y);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_DARK);
      const lineas: string[] = doc.splitTextToSize(texto, contentWidth);
      lineas.forEach(linea => {
        y = asegurarEspacio(y, 5);
        doc.text(linea, marginX, y);
        y += 5;
      });
      y += 2;
    };

    escribirTexto('Motivo de consulta', consulta.motivoConsulta || '—');

    const vitals: [string, string][] = [
      ['Peso', consulta.pesoEnConsulta != null ? `${consulta.pesoEnConsulta} kg` : '—'],
      ['Temperatura', consulta.temperatura != null ? `${consulta.temperatura} °C` : '—'],
      ['Frecuencia cardíaca', consulta.frecuenciaCardiaca != null ? `${consulta.frecuenciaCardiaca} lpm` : '—'],
      ['Frecuencia respiratoria', consulta.frecuenciaRespiratoria != null ? `${consulta.frecuenciaRespiratoria} rpm` : '—'],
      ['Mucosas', consulta.mucosas || '—'],
      ['Turgencia de piel', consulta.turgenciaPiel || '—'],
    ];
    if (vitals.some(([, valor]) => valor !== '—')) {
      y = etiquetaSeccion('Signos vitales', y);
      autoTable(doc, tableOptions({
        startY: y,
        head: [['Parámetro', 'Valor']],
        body: vitals,
        columnStyles: { 1: { cellWidth: contentWidth * 0.4 } }
      }));
      y = finalY() + 5;
    }

    if (consulta.anamnesis) escribirTexto('Anamnesis', consulta.anamnesis);
    if (consulta.examenFisico) escribirTexto('Examen físico', consulta.examenFisico);
    if (consulta.observaciones) escribirTexto('Observaciones', consulta.observaciones);

    if (consulta.diagnosticos?.length) {
      y = etiquetaSeccion('Diagnósticos', y);
      autoTable(doc, tableOptions({
        startY: y,
        head: [['Diagnóstico', 'Tipo', 'Estado']],
        body: consulta.diagnosticos.map(d => [d.nombre, d.tipo, d.estado])
      }));
      y = finalY() + 5;
    }

    if (consulta.tratamientos?.length) {
      y = etiquetaSeccion('Tratamientos', y);
      autoTable(doc, tableOptions({
        startY: y,
        head: [['Tratamiento', 'Inicio', 'Fin', 'Estado']],
        body: consulta.tratamientos.map(t => [
          t.nombre,
          t.fechaInicio ? formatearFechaClinica(t.fechaInicio) : '—',
          t.fechaFin ? formatearFechaClinica(t.fechaFin) : '—',
          t.estado
        ])
      }));
      y = finalY() + 5;
    }

    if (consulta.prescripciones?.length) {
      y = etiquetaSeccion('Prescripciones', y);
      autoTable(doc, tableOptions({
        startY: y,
        head: [['Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Vía']],
        body: consulta.prescripciones.map(p => [
          p.medicamento,
          p.dosis,
          p.frecuencia,
          p.duracionDias ? `${p.duracionDias} días` : '—',
          p.viaAdministracion || '—'
        ])
      }));
      y = finalY() + 5;
    }

    const examenesLaboratorio = (consulta.archivos ?? []).filter(a => a.tipo === 'LABORATORIO');
    if (examenesLaboratorio.length) {
      y = etiquetaSeccion('Exámenes de laboratorio', y);
      autoTable(doc, tableOptions({
        startY: y,
        head: [['Examen', 'Fecha', 'Descripción']],
        body: examenesLaboratorio.map(a => [
          a.nombre,
          a.fechaCarga ? formatearFechaClinica(a.fechaCarga) : '—',
          a.descripcion || '—'
        ])
      }));
      y = finalY() + 5;
    }

    return y + 4;
  }
}
