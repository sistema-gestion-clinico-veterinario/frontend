export interface VentaLibreItemRequest {
  productoId: number;
  cantidad: number;
}

export interface VentaLibreRequest {
  companyId?: number;
  apoderadoId?: number;
  clienteNombre?: string;
  items: VentaLibreItemRequest[];
  metodoPago: 'EFECTIVO' | 'YAPE';
  montoRecibido?: number;
}
