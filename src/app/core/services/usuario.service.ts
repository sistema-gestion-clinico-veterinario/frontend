import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/usuarios`;

  resetPassword(userId: number, newPassword: string) {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/reset-password`, { userId, newPassword });
  }
}
