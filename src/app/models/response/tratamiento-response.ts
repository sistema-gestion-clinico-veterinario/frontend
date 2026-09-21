import { EstadoTratamiento } from '../request/tratamiento-request';

export interface TratamientoResponse {
  id: number;
  nombre: string;
  descripcion?: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: EstadoTratamiento;
  consultaId?: number;
  fechaConsulta?: string;
  veterinarioNombre?: string;
}
