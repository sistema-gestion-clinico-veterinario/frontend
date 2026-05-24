import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { MenuItemDTO, VistaDTO } from '../../models/response/auth-login-response.model';

@Injectable({
  providedIn: 'root'
})
export class MenuManagementService {
  private readonly http = inject(HttpClient);
  private readonly vistaUrl = `${environment.apiUrl}/admin/views`;
  private readonly roleUrl = `${environment.apiUrl}/admin/roles`;

  // Vistas API
  listarVistas(grupo?: string) {
    const params = grupo ? `?grupo=${grupo}` : '';
    return this.http.get<ApiResponse<VistaDTO[]>>(`${this.vistaUrl}${params}`);
  }

  crearVista(data: { codigo: string; nombre: string; grupo?: string; activo?: boolean }) {
    return this.http.post<ApiResponse<VistaDTO>>(`${this.vistaUrl}`, data);
  }

  actualizarVista(id: number, data: { nombre: string; grupo?: string; activo?: boolean }) {
    return this.http.put<ApiResponse<VistaDTO>>(`${this.vistaUrl}/${id}`, data);
  }

  eliminarVista(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.vistaUrl}/${id}`);
  }

  // Roles Vistas Permisos
  obtenerVistasPorRol(rolId: number) {
    return this.http.get<ApiResponse<MenuItemDTO[]>>(`${this.roleUrl}/${rolId}/views`);
  }

  asignarVistasPorRol(rolId: number, permisos: any[]) {
    return this.http.put<ApiResponse<MenuItemDTO[]>>(`${this.roleUrl}/${rolId}/views`, permisos);
  }
}
