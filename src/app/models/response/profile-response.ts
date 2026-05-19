import { HorarioEmpleadoResponse } from './horario-empleado-response';

export interface ProfileResponse {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  direccion: string;
  roles: string[];
  companyName: string;
  activo: boolean;
  empleadoId: number | null;
  genero: string | null;
  tipoDocumento: string | null;
  numeroColegiatura: string | null;
  observaciones: string | null;
  fotoUrl: string | null;
  especialidades: string[];
  tiposEmpleado: string[];
  horarios: HorarioEmpleadoResponse[];
  empleado: boolean;
}
