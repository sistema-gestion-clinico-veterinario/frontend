import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Permission, Role } from '../../models/response/permission';
import { Menu } from '../../models/response/auth-login-response.model';


@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/roles`;
  private readonly menuUrl = `${environment.apiUrl}/admin/menus`;

  listar() {
    return this.http.get<ApiResponse<Role[]>>(this.apiUrl);
  }

  listarPorEmpresa(companyId?: number) {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/empresa${params}`);
  }

  listarSistema() {
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/sistema`);
  }

  listarPermisos() {
    return this.http.get<ApiResponse<Permission[]>>(`${this.apiUrl}/permissions`);
  }

  listarMenus() {
    return this.http.get<ApiResponse<Menu[]>>(`${this.menuUrl}/all`);
  }

  crear(data: { name: string; companyId?: number; permissionIds: number[]; menuIds?: number[] }) {
    return this.http.post<ApiResponse<Role>>(this.apiUrl, data);
  }

  actualizar(id: number, data: { name: string; companyId?: number; permissionIds: number[]; menuIds?: number[] }) {
    return this.http.put<ApiResponse<Role>>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }
}
