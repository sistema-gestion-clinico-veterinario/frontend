import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, throwError } from 'rxjs';
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

  resendVerification(email: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/resend-verification?email=${encodeURIComponent(email)}`, {});
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

  switchRole(roleId: number): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/switch-role`, { roleId });
  }

  forgotPassword(email: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/forgot-password`, { email });
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

  confirmEmailChange(type: 'actual' | 'nuevo', token: string): Observable<ApiResponse<boolean>> {
    const endpoint = type === 'actual' ? 'confirm-current' : 'confirm-new';
    return this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/email-change/${endpoint}`, { token });
  }
}
