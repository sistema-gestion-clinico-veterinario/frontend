export interface ServicioResponse {
  id: number;
  companyId: number;
  companyName: string;
  nombre: string;
  descripcion: string;
  precio: number;
  disponible: boolean;
  activo: boolean;
  duracionEstimada?: Date;
  tipoEmpleadoId?: number;
  tipoEmpleadoNombre?: string;
}
