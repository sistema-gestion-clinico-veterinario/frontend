export interface AuthLoginData {
  token: string;
  roles: string[];
  companyId: number;
  companyName: string;
  permissions: string[];
  nombreCompleto: string;
  userType: string;
  passwordChanged: boolean;
  needsCompanySelection: boolean;
}

export interface AuthLoginResponse {
  success: boolean;
  message: string;
  data: AuthLoginData;
}
