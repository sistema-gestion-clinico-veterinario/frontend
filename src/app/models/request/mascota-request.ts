export interface MascotaRequest {
  nombreCompleto: string;
  especie: string;
  razaId: number;
  sexo: string;
  fechaNacimiento: string; 
  color?: string;
  peso?: number;
  apoderadoId: number;
}
