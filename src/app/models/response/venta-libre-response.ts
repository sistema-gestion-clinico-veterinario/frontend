export interface VentaLibreDetalleResponse {
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface VentaLibreResponse {
  id: number;
  numeroVenta: string;
  clienteNombre?: string;
  items: VentaLibreDetalleResponse[];
  total: number;
  metodoPago: string;
  montoRecibido?: number;
  cambio?: number;
  fecha: string;
}
