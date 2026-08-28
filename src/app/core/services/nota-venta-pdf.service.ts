import { Injectable } from '@angular/core';
import { CuentaCitaResponse } from '../../models/response/cuenta-cita-response';
import { PagoResponse } from '../../models/response/pago-response';

@Injectable({ providedIn: 'root' })
export class NotaVentaPdfService {
  async mostrar(cuenta: CuentaCitaResponse, pago: PagoResponse, empresa: string): Promise<void> {
    const { jsPDF: JsPdf } = await import('jspdf');
    const doc = new JsPdf({ unit: 'mm', format: 'a4' });
    const money = (value: number | null | undefined) => `S/ ${Number(value ?? 0).toFixed(2)}`;
    const folio = `NV-${String(pago.id).padStart(8, '0')}`;

    doc.setFillColor(8, 83, 164);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(empresa || 'Veterinaria', 16, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Atención veterinaria', 16, 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('NOTA DE VENTA', 194, 11, { align: 'right' });
    doc.setFontSize(9);
    doc.text(folio, 194, 18, { align: 'right' });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date(pago.fechaPago).toLocaleString('es-PE')}`, 16, 39);
    doc.text(`Cita: ${cuenta.numeroCita}`, 16, 45);
    doc.text(`Cliente: ${cuenta.apoderadoNombre}`, 16, 51);
    doc.text(`Paciente: ${cuenta.mascotaNombre}`, 110, 45);
    doc.text(`Método: ${pago.metodoPago}`, 110, 51);

    doc.setFillColor(241, 245, 249);
    doc.rect(16, 60, 178, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPCIÓN', 20, 66);
    doc.text('CANT.', 132, 66, { align: 'right' });
    doc.text('P. UNIT.', 160, 66, { align: 'right' });
    doc.text('TOTAL', 190, 66, { align: 'right' });

    let y = 76;
    doc.setFont('helvetica', 'normal');
    for (const detalle of cuenta.detalles) {
      doc.text(detalle.descripcion.slice(0, 58), 20, y);
      doc.text(String(detalle.cantidad), 132, y, { align: 'right' });
      doc.text(money(detalle.precioUnitario), 160, y, { align: 'right' });
      doc.text(money(detalle.subtotal), 190, y, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.line(16, y + 4, 194, y + 4);
      y += 10;
    }

    y = Math.max(y + 4, 110);
    doc.setFont('helvetica', 'normal');
    doc.text('Total de la cuenta', 150, y, { align: 'right' });
    doc.text(money(cuenta.total), 190, y, { align: 'right' });
    doc.text('Pagado anteriormente', 150, y + 7, { align: 'right' });
    doc.text(money(cuenta.montoPagado), 190, y + 7, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PAGO RECIBIDO', 150, y + 17, { align: 'right' });
    doc.text(money(pago.monto), 190, y + 17, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (pago.montoRecibido != null) doc.text(`Recibido: ${money(pago.montoRecibido)}   Vuelto: ${money(pago.cambio)}`, 190, y + 25, { align: 'right' });
    doc.text(`Saldo pendiente: ${money(pago.saldoPendiente)}`, 190, y + 32, { align: 'right' });

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('Documento interno de control. No es comprobante de pago tributario.', 105, 280, { align: 'center' });

    const blobUrl = URL.createObjectURL(doc.output('blob'));
    const opened = window.open(blobUrl, '_blank');
    if (opened) opened.opener = null;
    else doc.save(`${folio}-${cuenta.numeroCita}.pdf`);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}
