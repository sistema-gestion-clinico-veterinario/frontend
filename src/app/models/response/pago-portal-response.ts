export interface PagoPortalResponse {
  id: number;
  tipoItem: string;
  descripcion: string;
  citaId: number;
  mascotaNombre: string | null;
  servicioNombre: string | null;
  veterinarioNombre: string | null;
  total: number;
  montoPagado: number | null;
  estadoPago: string;
  metodoPago: string | null;
  montoRecibido: number | null;
  cambio: number | null;
  fechaPago: string | null;
  fecha: string;
  estadoCita: string | null;
}
