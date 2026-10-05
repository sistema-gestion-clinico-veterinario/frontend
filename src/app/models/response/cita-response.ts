import { EstadoCita } from "../../core/enums/estado-cita.enum";

export interface CitaResponse {
  id: number;
  version: number;
  mascotaId: number;
  mascotaNombre: string;
  apoderadoId: number;
  apoderadoNombre: string;
  apoderadoEmail?: string;
  /** Solo tras crear, reprogramar, reasignar o cancelar: el aviso al cliente no pudo ir por correo. */
  requiereAvisoManual?: boolean;
  telefonoAviso?: string | null;
  veterinarioId: number;
  veterinarioNombre: string;
  servicioId?: number;
  servicioNombre?: string;
  requiereConsultaClinica?: boolean;
  motivoCita: string;
  fechaHoraInicio: string;
  fechaHoraFin: string;
  duracionMinutos: number;
  estado: EstadoCita;
  notas?: string;
  consultaId?: number;
  esEmergencia: boolean;
  totalServicio?: number;
  montoPagado?: number;
  controlPreventivoIds?: number[];
}
