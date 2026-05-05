import { EstadoCita } from "../../core/enums/estado-cita.enum";

export interface CitaResponse {
  id: number;
  version: number;
  mascotaId: number;
  mascotaNombre: string;
  apoderadoId: number;
  apoderadoNombre: string;
  veterinarioId: number;
  veterinarioNombre: string;
  servicioId?: number;
  servicioNombre?: string;
  motivoCita: string;
  fechaHoraInicio: string;
  fechaHoraFin: string;
  duracionMinutos: number;
  estado: EstadoCita;
  notas?: string;
  consultaId?: number;
}
