export interface PagoResponse {
  id: number;
  citaId: number;
  numeroCita: string;
  metodoPago: string;
  monto: number;
  montoRecibido?: number;
  cambio?: number;
  saldoPendiente?: number;
  fechaPago: string;
  estado: string;
  mercadoPagoId?: string;
  mpStatus?: string;
  businessTraceId?: string;
  receiptStatus?: 'NOT_TRACKED' | 'PENDING' | 'GENERATED';
  receiptAttempts?: number;
  receiptError?: string;
}

export interface PagoListResponse {
  id: number;
  citaId: number;
  numeroCita: string;
  metodoPago: string;
  monto: number;
  montoRecibido: number | null;
  cambio: number | null;
  fechaPago: string;
  estado: string;
  mascotaNombre: string | null;
  servicioNombre: string | null;
  veterinarioNombre: string | null;
  clienteNombre: string | null;
  estadoCita: string | null;
}
