export interface VistaDTO {
  id: number;
  codigo: string;
  nombre: string;
  ruta: string;
  activo: boolean;
}

export interface MenuItemDTO {
  id: number;
  codigo: string;
  nombre: string;
  icono: string;
  ruta?: string;
  hijos?: MenuItemDTO[];
  vistas?: VistaDTO[];
  activo?: boolean;
  leer: boolean;
  escribir: boolean;
  modificar: boolean;
  eliminar: boolean;
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
  menu: MenuItemDTO[];
}

export interface AuthLoginResponse {
  success: boolean;
  message: string;
  data: AuthLoginData;
}
