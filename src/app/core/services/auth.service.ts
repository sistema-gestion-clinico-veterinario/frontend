import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, finalize, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest } from '../../models/request/login-request.model';
import { AuthLoginResponse } from '../../models/response/auth-login-response.model';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;
  private refreshInFlight$: Observable<AuthLoginResponse> | null = null;

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/login`, credentials);
  }

  setupAccount(token: string, password: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/setup-account`, { token, password });
  }

  verifyEmail(token: string): Observable<ApiResponse<void>> {
    return this.http.get<ApiResponse<void>>(`${this.baseUrl}/verify/${token}`);
  }

  resendVerification(email: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/resend-verification?email=${encodeURIComponent(email)}`, {});
  }

  changePassword(payload: { oldPassword: string; newPassword: string }): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/change-password`, payload);
  }

  refreshToken(refreshToken?: string): Observable<AuthLoginResponse> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const body = refreshToken ? { refreshToken } : {};
    this.refreshInFlight$ = this.http.post<AuthLoginResponse>(`${this.baseUrl}/refresh`, body).pipe(
      finalize(() => { this.refreshInFlight$ = null; }),
      shareReplay(1)
    );
    return this.refreshInFlight$;
  }

  logout(): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/logout`, {}, { withCredentials: true });
  }

  switchRole(roleName: string): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/switch-role`, { roleName });
  }

  forgotPassword(email: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/forgot-password`, { email });
  }

  validateResetToken(token: string): Observable<ApiResponse<void>> {
    return this.http.get<ApiResponse<void>>(`${this.baseUrl}/validate-reset-token?token=${token}`);
  }

  resetPassword(token: string, newPassword: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/reset-password`, { token, newPassword });
  }
}
