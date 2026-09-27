import { MetodoPago } from './pago-request';

export interface VentaLibreItemRequest {
  productoId: number;
  cantidad: number;
}

export interface VentaLibreRequest {
  companyId?: number;
  apoderadoId?: number;
  clienteNombre?: string;
  items: VentaLibreItemRequest[];
  metodoPago: MetodoPago;
  montoRecibido?: number;
}
