export interface PagoResponse {
  id: number;
  citaId: number;
  metodoPago: string;
  monto: number;
  montoRecibido?: number;
  cambio?: number;
  fechaPago: string;
  estado: string;
}
