import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminLoginRequest, LoginRequest } from '../../models/request/login-request.model';
import { AuthLoginResponse } from '../../models/response/auth-login-response.model';
import { ApiResponse } from '../../models/response/api-response';

export interface AccountClosureEligibility {
  eligible: boolean;
  reason: string | null;
  requiresPassword: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;
  private refreshInFlight$: Observable<AuthLoginResponse> | null = null;

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/login`, credentials);
  }

  /** Ruta reservada para SuperAdmin - no depende del slug de ninguna empresa. */
  adminLogin(credentials: AdminLoginRequest): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/admin-login`, credentials);
  }

  /** Canjea el código de un solo uso que /auth/google/callback dejó en la URL de retorno
   * tras el consentimiento de Google - equivale a la respuesta de login normal. */
  exchangeGoogleCode(code: string): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/google/exchange`, { code });
  }

  /** Paso previo a Google: deja en el servidor la clínica o el enlace de activación y devuelve un
   * código opaco, para que ninguno de los dos viaje por la URL que pasa por Google. */
  createGoogleIntent(context: { slug?: string | null; activationToken?: string | null }): Observable<ApiResponse<{ intent: string }>> {
    return this.http.post<ApiResponse<{ intent: string }>>(`${this.baseUrl}/google/intent`, context);
  }

  /** Debe apuntar al mismo dominio que el retorno de Google: la cookie que protege el flujo se
   * fija ahí y tiene que viajar de vuelta en el callback. */
  googleStartUrl(intent: string): string {
    const start = environment.googleRedirectUri.replace(/\/callback$/, '/start');
    return `${start}?intent=${encodeURIComponent(intent)}`;
  }

  getAccountClosureEligibility(): Observable<ApiResponse<AccountClosureEligibility>> {
    return this.http.get<ApiResponse<AccountClosureEligibility>>(`${this.baseUrl}/account/closure`);
  }

  requestAccountClosure(password: string | null): Observable<ApiResponse<{ retryAfterSeconds?: number } | undefined>> {
    return this.http.post<ApiResponse<{ retryAfterSeconds?: number } | undefined>>(`${this.baseUrl}/account/closure/request`, { password });
  }

  confirmAccountClosure(code: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/account/closure/confirm`, { code });
  }

  reactivateAccount(token: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/account/reactivate`, { token });
  }

  setupAccount(token: string, password: string, avisoLeido?: boolean): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/setup-account`, { token, password, avisoLeido });
  }

  resendVerification(email: string, slug?: string | null): Observable<ApiResponse<void>> {
    const slugParam = slug ? `&slug=${encodeURIComponent(slug)}` : '';
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/resend-verification?email=${encodeURIComponent(email)}${slugParam}`, {});
  }

  resendVerificationByToken(token: string, slug?: string | null): Observable<ApiResponse<{ email: string }>> {
    return this.http.post<ApiResponse<{ email: string }>>(`${this.baseUrl}/resend-verification-by-token`, { token, slug: slug ?? undefined });
  }

  adminChangeEmail(userId: number, newEmail: string, motivo: string): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/admin-email-change/${userId}`, { newEmail, motivo });
  }

  changePassword(payload: { oldPassword: string; newPassword: string }): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/change-password`, payload);
  }

  refreshToken(): Observable<AuthLoginResponse> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.http.post<AuthLoginResponse>(`${this.baseUrl}/refresh`, {}).pipe(
      finalize(() => { this.refreshInFlight$ = null; }),
      shareReplay(1)
    );
    return this.refreshInFlight$;
  }

  logout(): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/logout`, {}, { withCredentials: true });
  }

  currentSession(): Observable<AuthLoginResponse> {
    return this.http.get<AuthLoginResponse>(`${this.baseUrl}/session`);
  }

  switchRole(roleId: number): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/switch-role`, { roleId });
  }

  /** slug: empresa desde la que se pide el reset (misma pantalla que el login) - sin
   * el, el backend no puede desambiguar entre cuentas con el mismo correo en distintas
   * empresas y apunta solo a la credencial sin empresa (SuperAdmin). */
  forgotPassword(email: string, slug: string | null): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/forgot-password`, { email, slug });
  }

  validateResetToken(token: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/validate-reset-token`, { token }).pipe(
      catchError((error) => error?.status === 404 || error?.status === 405
        ? this.http.get<ApiResponse<void>>(`${this.baseUrl}/validate-reset-token`, { params: { token } })
        : throwError(() => error))
    );
  }

  resetPassword(token: string, newPassword: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/reset-password`, { token, newPassword });
  }

  requestEmailChange(currentPassword: string, newEmail: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/email-change/request`, {
      currentPassword,
      newEmail
    });
  }

  cancelEmailChange(token: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/email-change/cancel`, { token });
  }

  confirmEmailChange(type: 'actual' | 'nuevo', token: string): Observable<ApiResponse<boolean>> {
    const endpoint = type === 'actual' ? 'confirm-current' : 'confirm-new';
    return this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/email-change/${endpoint}`, { token });
  }
}
