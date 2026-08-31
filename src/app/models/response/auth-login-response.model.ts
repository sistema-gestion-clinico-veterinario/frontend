export interface VistaDTO {
  id: number;
  codigo: string;
  nombre: string;
  ruta?: string;
  grupo?: string;
  orden?: number;
  ordenGrupo?: number | null;
  activo: boolean;
  icono?: string;
}

export interface MenuItemDTO extends VistaDTO {
  leer: boolean;
  escribir: boolean;
  modificar: boolean;
  eliminar: boolean;
}

export interface MenuStructureDTO {
  ventanaId?: number;
  ventanaCodigo?: string;
  ventanaNombre: string;
  ventanaIcono?: string;
  presentacion?: MenuPresentation;
  grupo?: string;
  orden: number;
  vistas: MenuItemDTO[];
}

export type RoleScope = 'PLATFORM' | 'STAFF' | 'CLIENT';
export type RolePurpose = 'PLATFORM_ADMIN' | 'COMPANY_ADMIN' | 'CLIENT_PORTAL' | 'CUSTOM';
export type MenuPresentation = 'GROUPED' | 'FLAT';

export interface AssignedRoleDTO {
  id: number;
  name: string;
  scope: RoleScope;
  purpose: RolePurpose;
}

export interface AuthLoginData {
  roles: string[];
  assignedRoles?: string[];
  availableRoles?: AssignedRoleDTO[];
  activeRoleId?: number;
  activeRoleName?: string;
  activeRoleScope?: RoleScope;
  activeRolePurpose?: RolePurpose;
  permissionVersion?: number;
  companyId: number;
  companyName: string;
  nombreCompleto: string;
  userType: string;
  empleadoId?: number;
  passwordChanged: boolean;
  needsCompanySelection: boolean;
  menu: (MenuStructureDTO | MenuItemDTO)[];
}

export interface AuthLoginResponse {
  success: boolean;
  message: string;
  data: AuthLoginData;
}
