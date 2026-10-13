export interface LoginRequest {

  slug?: string;
  username: string;
  password: string;
  reactivarCuenta?: boolean;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}
