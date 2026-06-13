export interface MascotaResponse {
  id: number;
  nombreCompleto: string;
  especie: string;
  raza: string;
  razaId: number;
  razaNombre: string;
  sexo: string;
  fechaNacimiento: string;
  color?: string;
  peso?: number;
  fotoUrl?: string;
  activo: boolean;
  apoderadoId: number;
  apoderadoNombreCompleto: string;
  ultimoDiagnostico?: string;
  tieneHistoriaClinica?: boolean;
}
