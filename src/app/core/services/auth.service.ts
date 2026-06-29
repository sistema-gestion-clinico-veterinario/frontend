import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest } from '../../models/request/login-request.model';
import { AuthLoginResponse } from '../../models/response/auth-login-response.model';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<AuthLoginResponse> {
    const payload = {
      ...credentials,
      email: credentials.email.trim(),
      password: credentials.password.trim()
    };
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/login`, payload);
  }

  setupAccount(token: string, password: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/setup-account`, { token, password: password.trim() });
  }

  verifyEmail(token: string): Observable<ApiResponse<void>> {
    return this.http.get<ApiResponse<void>>(`${this.baseUrl}/verify/${token}`);
  }

  resendVerification(email: string): Observable<ApiResponse<void>> {
    const trimmed = email.trim();
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/resend-verification?email=${encodeURIComponent(trimmed)}`, {});
  }

  changePassword(payload: { oldPassword: string; newPassword: string }): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/change-password`, {
      oldPassword: payload.oldPassword.trim(),
      newPassword: payload.newPassword.trim()
    });
  }

  refreshToken(refreshToken: string): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/refresh`, { refreshToken });
  }

  switchRole(roleName: string): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/switch-role`, { roleName });
  }

  forgotPassword(email: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/forgot-password`, { email: email.trim() });
  }

  validateResetToken(token: string): Observable<ApiResponse<void>> {
    return this.http.get<ApiResponse<void>>(`${this.baseUrl}/validate-reset-token?token=${token}`);
  }

  resetPassword(token: string, newPassword: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/reset-password`, { token, newPassword: newPassword.trim() });
  }
}
