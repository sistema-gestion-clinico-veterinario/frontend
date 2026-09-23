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
  /** true si el registro encontró (por DNI o correo) una identidad ya existente y la
   * reutilizó - el correo escrito en este formulario se descartó; correoExistente es
   * el que de verdad quedó guardado. */
  identidadExistente?: boolean;
  correoExistente?: string;
}
