export interface HorarioEmpleadoRequest {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface EmpleadoRequest {
  id?: number;
  nombre: string;
  apellido: string;
  email: string;
  numeroDocumento: string;
  tipoDocumento: string;
  telefono: string;
  direccion: string;
  roles: string[];
  companyId?: number;
  genero: string;
  observaciones?: string;
  fotoUrl?: string;
  numeroColegiatura?: string;
  especialidades?: string[];
  tiposEmpleado?: string[];
  estado?: boolean;
  horarios?: HorarioEmpleadoRequest[];
}
