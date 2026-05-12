export interface ServicioRequest {
  companyId?: number;
  nombre: string;
  descripcion: string;
  precio: number;
  disponible?: boolean;
}
