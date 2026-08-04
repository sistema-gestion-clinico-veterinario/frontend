export type TipoDetalleCuenta =
  | 'SERVICIO'
  | 'VACUNA'
  | 'MEDICAMENTO'
  | 'INSUMO'
  | 'PROCEDIMIENTO'
  | 'SERVICIO_ADICIONAL'
  | 'DESCUENTO'
  | 'OTRO';

export interface DetalleCuentaResponse {
  id: number;
  tipo: TipoDetalleCuenta;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  esServicioBase: boolean;
}

export interface CuentaCitaResponse {
  citaId: number;
  numeroCita: string;
  mascotaNombre: string;
  apoderadoNombre: string;
  servicioNombre: string;
  fechaAtencion: string;
  estadoCita: string;
  companyId: number;
  total: number;
  montoPagado: number;
  saldoPendiente: number;
  estadoPago: 'PENDIENTE' | 'PAGO_PARCIAL' | 'PAGADA';
  detalles: DetalleCuentaResponse[];
}

export interface DetalleCuentaRequest {
  tipo: TipoDetalleCuenta;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}
