import { TipoInactividad } from './apoderado-estado-response';

export interface EmpleadoListResponse {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  numeroColegiatura?: string;
  fotoUrl?: string;
  activo: boolean;
  cuentaPendiente?: boolean;
  tipoInactividad?: TipoInactividad | null;
  tiposEmpleado: string[];
  tipoEmpleadoIds?: number[];
  esVeterinario?: boolean;
  especialidades: string[];
  especialidadIds?: number[];
  userId?: number;
}
