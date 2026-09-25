import { Injectable, inject } from '@angular/core';
import type jsPDF from 'jspdf';
import { CuentaCitaResponse } from '../../models/response/cuenta-cita-response';
import { PagoResponse } from '../../models/response/pago-response';
import { VentaLibreResponse } from '../../models/response/venta-libre-response';
import { montoEnLetrasSoles } from '../../shared/utils/monto-en-letras.util';
import { AuditLogService } from './audit-log.service';
import { EncabezadoEmpresaPdf } from './historia-clinica-pdf.service';

const TEXT_MUTED: [number, number, number] = [90, 90, 90];
const TEXT_DARK: [number, number, number] = [20, 20, 20];
const BORDER: [number, number, number] = [180, 180, 180];

const METODO_PAGO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape'
};

const ANCHO_PAGINA = 80;
const MARGIN_X = 4;
const CONTENT_WIDTH = ANCHO_PAGINA - MARGIN_X * 2;
const CENTRO_X = ANCHO_PAGINA / 2;

@Injectable({ providedIn: 'root' })
export class NotaVentaPdfService {
  private readonly auditLogService = inject(AuditLogService);

  async mostrar(
    cuenta: CuentaCitaResponse,
    pago: PagoResponse,
    empresa: EncabezadoEmpresaPdf | null = null,
    logoDataUrl: string | null = null
  ): Promise<void> {
    const { jsPDF: JsPdf } = await import('jspdf');
    const folio = `NV-${String(pago.id).padStart(8, '0')}`;

    const medidor = new JsPdf({ unit: 'mm', format: [ANCHO_PAGINA, 400] });
    const alturaFinal = this.construirContenido(medidor, false, cuenta, pago, empresa, logoDataUrl, folio);

    const doc = new JsPdf({ unit: 'mm', format: [ANCHO_PAGINA, alturaFinal] });
    this.construirContenido(doc, true, cuenta, pago, empresa, logoDataUrl, folio);

    const blobUrl = URL.createObjectURL(doc.output('blob'));
    const opened = window.open(blobUrl, '_blank');
    if (opened) opened.opener = null;
    else doc.save(`${folio}-${cuenta.numeroCita}.pdf`);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    this.auditLogService.registrarDescarga('NOTA_VENTA_PDF', cuenta.numeroCita).subscribe();
  }

  async mostrarVentaLibre(
    venta: VentaLibreResponse,
    empresa: EncabezadoEmpresaPdf | null = null,
    logoDataUrl: string | null = null
  ): Promise<void> {
    const { jsPDF: JsPdf } = await import('jspdf');

    const medidor = new JsPdf({ unit: 'mm', format: [ANCHO_PAGINA, 400] });
    const alturaFinal = this.construirContenidoVentaLibre(medidor, false, venta, empresa, logoDataUrl);

    const doc = new JsPdf({ unit: 'mm', format: [ANCHO_PAGINA, alturaFinal] });
    this.construirContenidoVentaLibre(doc, true, venta, empresa, logoDataUrl);

    const blobUrl = URL.createObjectURL(doc.output('blob'));
    const opened = window.open(blobUrl, '_blank');
    if (opened) opened.opener = null;
    else doc.save(`${venta.numeroVenta}.pdf`);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    this.auditLogService.registrarDescarga('NOTA_VENTA_PDF', venta.numeroVenta).subscribe();
  }

  /** Dibuja (o solo mide, si dibujar=false) toda la nota de venta y devuelve el alto final
   * usado. El primer paso mide sobre una página "grande" de sobra para saber cuánto alto
   * necesita el contenido real; el segundo dibuja de verdad sobre una página ya creada con
   * ese alto exacto - jsPDF convierte cada coordenada Y al alto de página vigente en el
   * momento de dibujar, así que no se puede "achicar" la página después de haber dibujado. */
  private construirContenido(
    doc: jsPDF,
    dibujar: boolean,
    cuenta: CuentaCitaResponse,
    pago: PagoResponse,
    empresa: EncabezadoEmpresaPdf | null,
    logoDataUrl: string | null,
    folio: string
  ): number {
    const money = (value: number | null | undefined) => `S/ ${Number(value ?? 0).toFixed(2)}`;

    const linea = (yPos: number) => {
      if (!dibujar) return;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(MARGIN_X, yPos, ANCHO_PAGINA - MARGIN_X, yPos);
    };

    const centrar = (texto: string, yPos: number, size: number, bold = false, color = TEXT_DARK): number => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lineas: string[] = doc.splitTextToSize(texto, CONTENT_WIDTH);
      if (dibujar) {
        doc.setTextColor(...color);
        lineas.forEach((l: string, i: number) => doc.text(l, CENTRO_X, yPos + i * size * 0.42, { align: 'center' }));
      }
      return yPos + lineas.length * size * 0.42;
    };

    const filaDatoValor = (yPos: number, etiqueta: string, valor: string, size = 7.5): number => {
      doc.setFontSize(size);
      doc.setFont('helvetica', 'bold');
      const anchoEtiqueta = doc.getTextWidth(etiqueta);
      doc.setFont('helvetica', 'normal');
      const lineas: string[] = doc.splitTextToSize(valor, CONTENT_WIDTH);
      if (dibujar) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...TEXT_MUTED);
        doc.text(etiqueta, MARGIN_X, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...TEXT_DARK);
        lineas.forEach((l: string, i: number) => {
          doc.text(l, i === 0 ? MARGIN_X + anchoEtiqueta + 1.2 : MARGIN_X, yPos + i * 3.6);
        });
      }
      return Math.max(yPos + lineas.length * 3.6, yPos + 3.6);
    };

    const filaTotal = (yPos: number, etiqueta: string, valor: string, negrita = false): number => {
      if (dibujar) {
        doc.setFont('helvetica', negrita ? 'bold' : 'normal');
        doc.setFontSize(negrita ? 9.5 : 7.5);
        doc.setTextColor(...(negrita ? TEXT_DARK : TEXT_MUTED));
        doc.text(etiqueta, MARGIN_X, yPos);
        doc.setTextColor(...TEXT_DARK);
        doc.text(valor, ANCHO_PAGINA - MARGIN_X, yPos, { align: 'right' });
      }
      return yPos + (negrita ? 5.5 : 4.4);
    };

    let y = 6;

    if (logoDataUrl) {
      try {
        const props = doc.getImageProperties(logoDataUrl);
        const maxAncho = 20;
        const maxAlto = 14;
        let ancho = maxAncho;
        let alto = (ancho * props.height) / props.width;
        if (alto > maxAlto) {
          alto = maxAlto;
          ancho = (alto * props.width) / props.height;
        }
        if (dibujar) doc.addImage(logoDataUrl, CENTRO_X - ancho / 2, y, ancho, alto);
        y += alto + 3;
      } catch {}
    }

    y = centrar(empresa?.name || 'Clínica veterinaria', y + 1, 10.5, true) + 1;
    if (empresa?.address) y = centrar(empresa.address, y, 7, false, TEXT_MUTED) + 0.5;
    const contacto = [empresa?.phone, empresa?.email].filter(Boolean).join('  ·  ');
    if (contacto) y = centrar(contacto, y, 7, false, TEXT_MUTED) + 0.5;
    if (empresa?.ruc) y = centrar(`RUC: ${empresa.ruc}`, y, 7, false, TEXT_MUTED) + 0.5;
    y += 2;
    linea(y);
    y += 5;

    y = centrar('NOTA DE VENTA', y, 11.5, true) + 1;
    y = centrar(folio, y, 8, false, TEXT_MUTED) + 3;
    linea(y);
    y += 5;

    y = filaDatoValor(y, 'Cliente: ', cuenta.apoderadoNombre || '—') + 0.5;
    y = filaDatoValor(y, 'Mascota: ', cuenta.mascotaNombre || '—') + 0.5;
    y = filaDatoValor(y, 'N.° de cita: ', cuenta.numeroCita) + 0.5;
    y = filaDatoValor(y, 'Fecha: ', new Date(pago.fechaPago).toLocaleString('es-PE')) + 2;
    linea(y);
    y += 5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    if (dibujar) {
      doc.setTextColor(...TEXT_MUTED);
      doc.text('CANT', MARGIN_X, y);
      doc.text('DESCRIPCIÓN', MARGIN_X + 9, y);
      doc.text('TOTAL', ANCHO_PAGINA - MARGIN_X, y, { align: 'right' });
    }
    y += 2;
    linea(y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const detalle of cuenta.detalles) {
      const lineasDescripcion: string[] = doc.splitTextToSize(detalle.descripcion, CONTENT_WIDTH - 9 - 16);
      if (dibujar) {
        doc.setTextColor(...TEXT_DARK);
        doc.text(String(detalle.cantidad), MARGIN_X, y);
        doc.text(lineasDescripcion, MARGIN_X + 9, y);
        doc.text(money(detalle.subtotal), ANCHO_PAGINA - MARGIN_X, y, { align: 'right' });
      }
      y += lineasDescripcion.length * 3.6 + 1.4;
    }
    y += 1;
    linea(y);
    y += 5;

    if (cuenta.montoPagado > 0) y = filaTotal(y, 'Total de la cuenta', money(cuenta.total));
    if (cuenta.montoPagado > 0) y = filaTotal(y, 'Pagado anteriormente', money(cuenta.montoPagado));
    y = filaTotal(y, 'Pago recibido', money(pago.monto), true);
    if (pago.metodoPago === 'EFECTIVO' && pago.montoRecibido != null) {
      y = filaTotal(y, 'Recibido en efectivo', money(pago.montoRecibido));
      y = filaTotal(y, 'Vuelto entregado', money(pago.cambio));
    }
    if (Number(pago.saldoPendiente ?? 0) > 0) y = filaTotal(y, 'Saldo pendiente', money(pago.saldoPendiente));
    y += 2;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    const enLetras: string[] = doc.splitTextToSize(`SON: ${montoEnLetrasSoles(pago.monto)}`, CONTENT_WIDTH);
    if (dibujar) {
      doc.setTextColor(...TEXT_MUTED);
      enLetras.forEach((l: string, i: number) => doc.text(l, MARGIN_X, y + i * 3.4));
    }
    y += enLetras.length * 3.4 + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    if (dibujar) {
      doc.setTextColor(...TEXT_DARK);
      doc.text(`Forma de pago: ${METODO_PAGO_LABEL[pago.metodoPago] ?? pago.metodoPago}`, MARGIN_X, y);
    }
    y += 4;
    if (dibujar) {
      doc.text(`Condición: ${Number(pago.saldoPendiente ?? 0) > 0 ? 'Pago parcial' : 'Pagado al contado'}`, MARGIN_X, y);
    }
    y += 6;
    linea(y);
    y += 5;

    y = centrar('Documento interno de control administrativo.', y, 6.5, false, TEXT_MUTED);
    y = centrar('No constituye comprobante de pago tributario (boleta o factura electrónica).', y, 6.5, false, TEXT_MUTED) + 2;
    y = centrar('¡Gracias por su preferencia!', y, 7.5, true, TEXT_MUTED);
    y += 6;

    return y;
  }

  private construirContenidoVentaLibre(
    doc: jsPDF,
    dibujar: boolean,
    venta: VentaLibreResponse,
    empresa: EncabezadoEmpresaPdf | null,
    logoDataUrl: string | null
  ): number {
    const money = (value: number | null | undefined) => `S/ ${Number(value ?? 0).toFixed(2)}`;

    const linea = (yPos: number) => {
      if (!dibujar) return;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(MARGIN_X, yPos, ANCHO_PAGINA - MARGIN_X, yPos);
    };

    const centrar = (texto: string, yPos: number, size: number, bold = false, color = TEXT_DARK): number => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lineas: string[] = doc.splitTextToSize(texto, CONTENT_WIDTH);
      if (dibujar) {
        doc.setTextColor(...color);
        lineas.forEach((l: string, i: number) => doc.text(l, CENTRO_X, yPos + i * size * 0.42, { align: 'center' }));
      }
      return yPos + lineas.length * size * 0.42;
    };

    const filaDatoValor = (yPos: number, etiqueta: string, valor: string, size = 7.5): number => {
      doc.setFontSize(size);
      doc.setFont('helvetica', 'bold');
      const anchoEtiqueta = doc.getTextWidth(etiqueta);
      doc.setFont('helvetica', 'normal');
      const lineas: string[] = doc.splitTextToSize(valor, CONTENT_WIDTH);
      if (dibujar) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...TEXT_MUTED);
        doc.text(etiqueta, MARGIN_X, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...TEXT_DARK);
        lineas.forEach((l: string, i: number) => {
          doc.text(l, i === 0 ? MARGIN_X + anchoEtiqueta + 1.2 : MARGIN_X, yPos + i * 3.6);
        });
      }
      return Math.max(yPos + lineas.length * 3.6, yPos + 3.6);
    };

    const filaTotal = (yPos: number, etiqueta: string, valor: string, negrita = false): number => {
      if (dibujar) {
        doc.setFont('helvetica', negrita ? 'bold' : 'normal');
        doc.setFontSize(negrita ? 9.5 : 7.5);
        doc.setTextColor(...(negrita ? TEXT_DARK : TEXT_MUTED));
        doc.text(etiqueta, MARGIN_X, yPos);
        doc.setTextColor(...TEXT_DARK);
        doc.text(valor, ANCHO_PAGINA - MARGIN_X, yPos, { align: 'right' });
      }
      return yPos + (negrita ? 5.5 : 4.4);
    };

    let y = 6;

    if (logoDataUrl) {
      try {
        const props = doc.getImageProperties(logoDataUrl);
        const maxAncho = 20;
        const maxAlto = 14;
        let ancho = maxAncho;
        let alto = (ancho * props.height) / props.width;
        if (alto > maxAlto) {
          alto = maxAlto;
          ancho = (alto * props.width) / props.height;
        }
        if (dibujar) doc.addImage(logoDataUrl, CENTRO_X - ancho / 2, y, ancho, alto);
        y += alto + 3;
      } catch {}
    }

    y = centrar(empresa?.name || 'Clínica veterinaria', y + 1, 10.5, true) + 1;
    if (empresa?.address) y = centrar(empresa.address, y, 7, false, TEXT_MUTED) + 0.5;
    const contacto = [empresa?.phone, empresa?.email].filter(Boolean).join('  ·  ');
    if (contacto) y = centrar(contacto, y, 7, false, TEXT_MUTED) + 0.5;
    if (empresa?.ruc) y = centrar(`RUC: ${empresa.ruc}`, y, 7, false, TEXT_MUTED) + 0.5;
    y += 2;
    linea(y);
    y += 5;

    y = centrar('NOTA DE VENTA', y, 11.5, true) + 1;
    y = centrar(venta.numeroVenta, y, 8, false, TEXT_MUTED) + 3;
    linea(y);
    y += 5;

    y = filaDatoValor(y, 'Cliente: ', venta.clienteNombre || 'Cliente de mostrador') + 0.5;
    y = filaDatoValor(y, 'Fecha: ', new Date(venta.fecha).toLocaleString('es-PE')) + 2;
    linea(y);
    y += 5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    if (dibujar) {
      doc.setTextColor(...TEXT_MUTED);
      doc.text('CANT', MARGIN_X, y);
      doc.text('DESCRIPCIÓN', MARGIN_X + 9, y);
      doc.text('TOTAL', ANCHO_PAGINA - MARGIN_X, y, { align: 'right' });
    }
    y += 2;
    linea(y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const item of venta.items) {
      const lineasDescripcion: string[] = doc.splitTextToSize(item.productoNombre, CONTENT_WIDTH - 9 - 16);
      if (dibujar) {
        doc.setTextColor(...TEXT_DARK);
        doc.text(String(item.cantidad), MARGIN_X, y);
        doc.text(lineasDescripcion, MARGIN_X + 9, y);
        doc.text(money(item.subtotal), ANCHO_PAGINA - MARGIN_X, y, { align: 'right' });
      }
      y += lineasDescripcion.length * 3.6 + 1.4;
    }
    y += 1;
    linea(y);
    y += 5;

    y = filaTotal(y, 'Total', money(venta.total), true);
    if (venta.metodoPago === 'EFECTIVO' && venta.montoRecibido != null) {
      y = filaTotal(y, 'Recibido en efectivo', money(venta.montoRecibido));
      y = filaTotal(y, 'Vuelto entregado', money(venta.cambio));
    }
    y += 2;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    const enLetras: string[] = doc.splitTextToSize(`SON: ${montoEnLetrasSoles(venta.total)}`, CONTENT_WIDTH);
    if (dibujar) {
      doc.setTextColor(...TEXT_MUTED);
      enLetras.forEach((l: string, i: number) => doc.text(l, MARGIN_X, y + i * 3.4));
    }
    y += enLetras.length * 3.4 + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    if (dibujar) {
      doc.setTextColor(...TEXT_DARK);
      doc.text(`Forma de pago: ${METODO_PAGO_LABEL[venta.metodoPago] ?? venta.metodoPago}`, MARGIN_X, y);
    }
    y += 4;
    if (dibujar) {
      doc.text('Condición: Pagado al contado', MARGIN_X, y);
    }
    y += 6;
    linea(y);
    y += 5;

    y = centrar('Documento interno de control administrativo.', y, 6.5, false, TEXT_MUTED);
    y = centrar('No constituye comprobante de pago tributario (boleta o factura electrónica).', y, 6.5, false, TEXT_MUTED) + 2;
    y = centrar('¡Gracias por su preferencia!', y, 7.5, true, TEXT_MUTED);
    y += 6;

    return y;
  }
}
