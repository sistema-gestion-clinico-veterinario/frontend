import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { VistaDTO } from '../../models/response/auth-login-response.model';

export interface VentanaDTO {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MenuManagementService {
  private readonly http = inject(HttpClient);
  private readonly vistaUrl = `${environment.apiUrl}/admin/views`;
  private readonly ventanaUrl = `${environment.apiUrl}/admin/windows`;

  // Vistas API
  listarVistas(grupo?: string) {
    const params = grupo ? `?grupo=${grupo}` : '';
    return this.http.get<ApiResponse<VistaDTO[]>>(`${this.vistaUrl}${params}`);
  }

  listarVentanas() {
    return this.http.get<ApiResponse<VentanaDTO[]>>(`${this.ventanaUrl}`);
  }

  crearVista(data: { codigo: string; nombre: string; grupo?: string; ventanaId?: number | null; orden?: number; ordenGrupo?: number | null; activo?: boolean }) {
    return this.http.post<ApiResponse<VistaDTO>>(`${this.vistaUrl}`, data);
  }

  actualizarVista(id: number, data: { nombre: string; grupo?: string; ventanaId?: number | null; orden?: number; ordenGrupo?: number | null; activo?: boolean; icono?: string | null }) {
    return this.http.put<ApiResponse<VistaDTO>>(`${this.vistaUrl}/${id}`, data);
  }

  eliminarVista(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.vistaUrl}/${id}`);
  }

  reordenarVistas(items: { id: number; orden: number; grupo: string; ordenGrupo: number | null }[]) {
    return this.http.put<ApiResponse<void>>(`${this.vistaUrl}/reorder`, items);
  }
}
