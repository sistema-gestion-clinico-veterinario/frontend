export interface ServicioRequest {
  companyId?: number;
  nombre: string;
  descripcion: string;
  precio: number;
  disponible?: boolean;
  duracionEstimada?: number;
  tipoEmpleadoId?: number | null;
  especialidadId?: number | null;
  tipoControlPreventivo?: 'VACUNACION' | 'DESPARASITACION' | 'NO_APLICA';
}
