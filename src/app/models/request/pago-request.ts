export type MetodoPago = 'EFECTIVO' | 'YAPE';

export interface PagoRequest {
  citaId: number;
  metodoPago: MetodoPago;
  montoRecibido?: number;
  yapePhoneNumber?: number;
  yapeOtp?: number;
  payerEmail?: string;
}
