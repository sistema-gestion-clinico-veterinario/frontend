import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Role } from '../../models/response/permission';

export interface RolVentanaPermiso {
  ventanaId: number;
  codigo: string;
  nombre: string;
  icono: string | null;
  parentId: number | null;
  parentCodigo: string | null;
  leer: boolean;
  escribir: boolean;
  modificar: boolean;
  eliminar: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/roles`;

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

  crear(data: { name: string; descripcion?: string; companyId?: number }) {
    return this.http.post<ApiResponse<Role>>(this.apiUrl, data);
  }

  actualizar(id: number, data: { name: string; descripcion?: string; companyId?: number }) {
    return this.http.put<ApiResponse<Role>>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  getVentanas(roleId: number) {
    return this.http.get<ApiResponse<RolVentanaPermiso[]>>(`${this.apiUrl}/${roleId}/ventanas`);
  }

  saveVentanas(roleId: number, permisos: RolVentanaPermiso[]) {
    return this.http.put<ApiResponse<RolVentanaPermiso[]>>(`${this.apiUrl}/${roleId}/ventanas`, permisos);
  }
}
