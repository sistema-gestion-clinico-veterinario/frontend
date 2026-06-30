import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Role } from '../../models/response/permission';
import { map } from 'rxjs';

export interface RolVentanaPermiso {
  ventanaId: number;
  vistaId?: number;
  codigo: string;
  nombre: string;
  icono: string | null;
  ruta?: string;
  parentId: number | null;
  parentCodigo: string | null;
  leer: boolean;
  escribir: boolean;
  modificar: boolean;
  eliminar: boolean;
  vistas?: any[]; // For vistas inside the ventana
}

interface RolVistaPermiso {
  vistaId: number;
  codigo: string;
  nombre: string;
  grupo?: string;
  ruta?: string;
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
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/company${params}`);
  }

  listarSistema() {
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/system`);
  }

  crear(data: { name: string; descripcion?: string; companyId?: number }) {
    return this.http.post<ApiResponse<Role>>(this.apiUrl, data);
  }

  actualizar(id: number, data: { name: string; descripcion?: string; companyId?: number }) {
    return this.http.put<ApiResponse<Role>>(`${this.apiUrl}/${id}`, data);
  }

  toggleActivo(id: number) {
    return this.http.patch<ApiResponse<Role>>(`${this.apiUrl}/${id}/toggle-active`, {});
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  getVentanas(roleId: number) {
    return this.http.get<ApiResponse<RolVistaPermiso[]>>(`${this.apiUrl}/${roleId}/views`).pipe(
      map((res) => ({
        ...res,
        data: res.data.map((vista) => this.toRolVentanaPermiso(vista))
      }))
    );
  }

  saveVentanas(roleId: number, permisos: RolVentanaPermiso[]) {
    const payload = permisos.map((permiso) => ({
      vistaId: permiso.vistaId ?? permiso.ventanaId,
      codigo: permiso.codigo,
      nombre: permiso.nombre,
      grupo: permiso.parentCodigo,
      leer: permiso.leer,
      escribir: permiso.escribir,
      modificar: permiso.modificar,
      eliminar: permiso.eliminar
    }));

    return this.http.put<ApiResponse<RolVistaPermiso[]>>(`${this.apiUrl}/${roleId}/views`, payload).pipe(
      map((res) => ({
        ...res,
        data: res.data.map((vista) => this.toRolVentanaPermiso(vista))
      }))
    );
  }

  private toRolVentanaPermiso(vista: RolVistaPermiso): RolVentanaPermiso {
    return {
      ventanaId: vista.vistaId,
      vistaId: vista.vistaId,
      codigo: vista.codigo,
      nombre: vista.nombre,
      icono: 'pi pi-circle',
      ruta: vista.ruta,
      parentId: null,
      parentCodigo: vista.grupo ?? null,
      leer: vista.leer,
      escribir: vista.escribir,
      modificar: vista.modificar,
      eliminar: vista.eliminar,
      vistas: []
    };
  }
}
