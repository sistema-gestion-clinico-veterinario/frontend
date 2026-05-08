import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Permission, Role } from '../../models/response/permission';


@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/roles`;

  listar() {
    return this.http.get<ApiResponse<Role[]>>(this.apiUrl);
  }

  listarPermisos() {
    return this.http.get<ApiResponse<Permission[]>>(`${this.apiUrl}/permissions`);
  }

  crear(data: { name: string; permissionIds: number[] }) {
    return this.http.post<ApiResponse<Role>>(this.apiUrl, data);
  }

  actualizar(id: number, data: { name: string; permissionIds: number[] }) {
    return this.http.put<ApiResponse<Role>>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }
}
