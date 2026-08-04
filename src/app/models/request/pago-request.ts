export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';

export interface PagoRequest {
  citaId: number;
  metodoPago: MetodoPago;
  monto?: number;
  montoRecibido?: number;
}
