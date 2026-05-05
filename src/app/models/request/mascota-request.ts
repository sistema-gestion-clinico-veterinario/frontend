export interface MascotaRequest {
  nombre: string;
  especie: string;
  raza: string;
  sexo: string;
  fechaNacimiento: string; // formato YYYY-MM-DD
  color?: string;
  peso?: number;
  apoderadoId: number;
}
