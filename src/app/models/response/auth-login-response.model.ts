export interface Menu {
  id: number;
  label: string;
  icon: string;
  path: string;
  sortOrder: number;
  parentId?: number;
  requiredPermission?: string;
  active: boolean;
  children?: Menu[];
}

export interface AuthLoginData {
  token: string;
  refreshToken: string;
  roles: string[];
  companyId: number;
  companyName: string;
  permissions: string[];
  nombreCompleto: string;
  userType: string;
  empleadoId?: number;
  passwordChanged: boolean;
  needsCompanySelection: boolean;
  menu: Menu[];
  assignedRoles?: string[];
}

export interface AuthLoginResponse {
  success: boolean;
  message: string;
  data: AuthLoginData;
}
