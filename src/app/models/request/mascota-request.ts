export interface MascotaRequest {
  nombreCompleto: string;
  especie: string;
  raza: string;
  sexo: string;
  fechaNacimiento: string; // formato YYYY-MM-DD
  color?: string;
  peso?: number;
  apoderadoId: number;
}
