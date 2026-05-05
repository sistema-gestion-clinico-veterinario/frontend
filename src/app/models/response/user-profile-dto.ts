export interface UserProfileDTO {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  direccion: string;
  roles: string[];
  activo: boolean;
  companyName?: string;
}
