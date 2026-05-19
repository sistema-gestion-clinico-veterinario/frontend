export interface PagoResponse {
  id: number;
  citaId: number;
  metodoPago: string;
  monto: number;
  montoRecibido?: number;
  cambio?: number;
  fechaPago: string;
  estado: string;
  mercadoPagoId?: string;
  mpStatus?: string;
}

export interface PagoListResponse {
  id: number;
  citaId: number;
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
