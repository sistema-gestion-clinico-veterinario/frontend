export interface MascotaCartillaResponse {
  id: number;
  nombreCompleto: string;
  especie: string;
  razaNombre: string;
  apoderadoNombreCompleto: string;
  apoderadoTelefono: string;
  apoderadoId: number;
  activo: boolean;
  fechaUltimaAplicacion: string | null;
  controlPendienteNombre: string | null;
  controlPendienteTipo: string | null;
  controlPendienteFecha: string | null;
  controlPendienteEstado: string | null;
  controlPendienteDiasRestantes: number | null;
  controlPendienteResumen: string | null;
  controlPendienteId: number | null;
}
