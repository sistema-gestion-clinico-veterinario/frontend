export interface ServicioResponse {
  id: number;
  companyId: number;
  companyName: string;
  nombre: string;
  descripcion: string;
  precio: number;
  disponible: boolean;
  activo: boolean;
  duracionEstimada?: number;
  permiteEmergencia?: boolean;
  tipoEmpleadoId?: number;
  tipoEmpleadoNombre?: string;
  tipoControlPreventivo?: 'VACUNACION' | 'DESPARASITACION' | 'NO_APLICA';
}
