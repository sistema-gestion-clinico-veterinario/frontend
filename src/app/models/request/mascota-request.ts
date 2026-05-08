export interface MascotaRequest {
  nombreCompleto: string;
  especie: string;
  raza: string;
  sexo: string;
  fechaNacimiento: string; 
  color?: string;
  peso?: number;
  apoderadoId: number;
}
