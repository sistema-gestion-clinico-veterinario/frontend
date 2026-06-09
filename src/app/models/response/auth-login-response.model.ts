export interface VistaDTO {
  id: number;
  codigo: string;
  nombre: string;
  ruta?: string;
  grupo?: string;
  orden?: number;
  ordenGrupo?: number | null;
  activo: boolean;
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
  grupo?: string;
  orden: number;
  vistas: MenuItemDTO[];
}

export interface AuthLoginData {
  token: string;
  refreshToken: string;
  roles: string[];
  assignedRoles?: string[];
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
