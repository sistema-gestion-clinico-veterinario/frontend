export interface LoginRequest {
  /** Ausente en el login "global" (sin marca de ninguna empresa en
   * particular) - el backend solo lo permite si el username tiene
   * exactamente una empresa activa. */
  slug?: string;
  username: string;
  password: string;
  reactivarCuenta?: boolean;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}
