export interface RecordatorioWhatsAppResponse {
  tipoRecordatorio: 'PREVENTIVO' | 'CITA';
  controlId?: number | null;
  citaId?: number | null;
  mascotaNombre: string;
  apoderadoId: number;
  apoderadoNombre: string;
  apoderadoTelefono: string;
  tipoControl: string;
  nombreControl: string;
  fechaRecomendada: string;
  estado: string;
  diasRestantes: number;
  resumenDias: string;
  mensajeWhatsApp: string;
}
