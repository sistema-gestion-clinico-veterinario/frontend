export interface CitaRequest {
  mascotaId: number;
  veterinarioId: number;
  motivoCita: string;
  fechaHoraInicio: string;
  servicioId?: number;
  notas?: string;
  version?: number;
  esEmergencia?: boolean;
}
