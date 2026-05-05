import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/roles`;

  listar() {
    return this.http.get<ApiResponse<any[]>>(this.apiUrl);
  }

  listarPermisos() {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/permissions`);
  }

  crear(data: { name: string; permissionIds: number[] }) {
    return this.http.post<ApiResponse<any>>(this.apiUrl, data);
  }

  actualizar(id: number, data: { name: string; permissionIds: number[] }) {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }
}
