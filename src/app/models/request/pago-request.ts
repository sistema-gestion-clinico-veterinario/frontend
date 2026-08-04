export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';

export interface PagoRequest {
  citaId: number;
  metodoPago: MetodoPago;
  monto?: number;
  montoRecibido?: number;

  /** Teléfono Yape del cliente (9 dígitos, sin +51) */
  yapePhoneNumber?: number;

  /** Código OTP de 6 dígitos de la app Yape */
  yapeOtp?: number;

  /** Email del pagador — requerido por MercadoPago para Yape */
  payerEmail?: string;
}
