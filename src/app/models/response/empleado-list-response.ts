export interface EmpleadoListResponse {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  numeroColegiatura?: string;
  fotoUrl?: string;
  activo: boolean;
  tiposEmpleado: string[];
  especialidades: string[];
  userId?: number;
}
