export interface MascotaRequest {
  nombreCompleto: string;
  especie: string;
  otraEspecie?: string;
  razaId: number;
  sexo: string;
  fechaNacimiento: string; 
  color?: string;
  peso?: number;
  fotoUrl?: string;
  apoderadoId: number;
}
