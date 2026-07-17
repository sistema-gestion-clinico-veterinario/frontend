export interface CitaRequest {
  mascotaId: number;
  veterinarioId: number;
  motivoCita: string;
  fechaHoraInicio: string;
  servicioId?: number;
  notas?: string;
  version?: number;
  esEmergencia?: boolean;
  controlPreventivoIds?: number[];
}

export interface CitaReprogramacionRequest {
  veterinarioId?: number;
  fechaHoraInicio: string;
  motivoReprogramacion?: string;
}
