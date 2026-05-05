export interface MascotaResponse {
  id: number;
  nombreCompleto: string;
  especie: string;
  raza: string;
  sexo: string;
  fechaNacimiento: string;
  peso: number;
  activo: boolean;
  apoderadoId: number;
  apoderadoNombreCompleto: string;
}
