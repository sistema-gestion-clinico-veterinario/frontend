export interface UserProfileDTO {
  id: number;
  apoderadoId?: number;
  email: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  direccion: string;
  roles: string[];
  activo: boolean;
  companyName?: string;
  roleIds?: number[];
}
