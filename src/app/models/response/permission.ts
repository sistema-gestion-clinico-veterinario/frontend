export interface Permission {
  id: number;
  name: string;
  label: string;
  description: string;
  module: string;
}

export interface Role {
  id: number;
  name: string;
  descripcion?: string;
  activo: boolean;
  companyId: number | null;
  scope: 'PLATFORM' | 'STAFF' | 'CLIENT';
  purpose: 'PLATFORM_ADMIN' | 'COMPANY_ADMIN' | 'CLIENT_PORTAL' | 'CUSTOM';
  systemManaged: boolean;
  protectedRole: boolean;
  permissionVersion: number;
  /** true solo si el rol no tiene ningún permiso concedido ni ningún usuario asignado
   * todavía — cambiar el ámbito después de eso puede dejar huérfanos permisos ya
   * guardados o romper el menú de un usuario activo. */
  ambitoEditable: boolean;
}
