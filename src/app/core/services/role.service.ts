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
  dataScope: 'OWN' | 'COMPANY';
  visibleMenu: boolean;
  vistas?: any[]; // For vistas inside the ventana
}

export interface RolMenuConfiguration {
  ventanaId: number;
  codigo: string;
  nombre: string;
  icono?: string;
  presentacion: 'GROUPED' | 'FLAT';
  orden: number;
}

export interface RolMenuOrderItem {
  tipo: 'MODULE' | 'VIEW';
  referenciaId: number;
  codigo: string;
  nombre: string;
  icono?: string;
  orden: number;
  vistas: RolMenuOrderItem[];
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
  dataScope: 'OWN' | 'COMPANY';
  visibleMenu: boolean;
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

  crear(data: { name: string; descripcion?: string; companyId?: number; scope?: 'PLATFORM' | 'STAFF' | 'CLIENT' }) {
    return this.http.post<ApiResponse<Role>>(this.apiUrl, data);
  }

  actualizar(id: number, data: { name: string; descripcion?: string; companyId?: number; scope?: 'PLATFORM' | 'STAFF' | 'CLIENT' }) {
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
      eliminar: permiso.eliminar,
      dataScope: permiso.dataScope ?? 'OWN'
    }));

    return this.http.put<ApiResponse<RolVistaPermiso[]>>(`${this.apiUrl}/${roleId}/views`, payload).pipe(
      map((res) => ({
        ...res,
        data: res.data.map((vista) => this.toRolVentanaPermiso(vista))
      }))
    );
  }

  listarRolesClienteAsignables(companyId?: number) {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/company/client-options${params}`);
  }

  listarRolesPersonalAsignables(companyId?: number) {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/company/staff-options${params}`);
  }

  getMenuConfiguration(roleId: number) {
    return this.http.get<ApiResponse<RolMenuConfiguration[]>>(`${this.apiUrl}/${roleId}/menu-configuration`);
  }

  saveMenuConfiguration(roleId: number, configuration: RolMenuConfiguration[]) {
    return this.http.put<ApiResponse<RolMenuConfiguration[]>>(`${this.apiUrl}/${roleId}/menu-configuration`, configuration);
  }

  getMenuOrder(roleId: number) {
    return this.http.get<ApiResponse<RolMenuOrderItem[]>>(`${this.apiUrl}/${roleId}/menu-order`);
  }

  saveMenuOrder(roleId: number, order: RolMenuOrderItem[]) {
    return this.http.put<ApiResponse<RolMenuOrderItem[]>>(`${this.apiUrl}/${roleId}/menu-order`, order);
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
      dataScope: vista.dataScope ?? 'OWN',
      visibleMenu: vista.visibleMenu ?? true,
      vistas: []
    };
  }
}
