import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { ApoderadoListResponse } from '../../models/response/apoderado-list-response';
import { environment } from '../../../environments/environment';
import { ApoderadoRequest } from '../../models/request/apoderado-request';
import { UserProfileDTO } from '../../models/response/user-profile-dto';

@Injectable({
  providedIn: 'root'
})
export class ApoderadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clientes/apoderados`;

  listar(companyId?: number, nombre?: string, numeroDocumento?: string, page: number = 0, size: number = 10) {
    let params = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) {
      params += `&companyId=${companyId}`;
    }
    if (nombre) params += `&nombre=${nombre}`;
    if (numeroDocumento) params += `&numeroDocumento=${numeroDocumento}`;
    return this.http.get<ApiResponse<Page<ApoderadoListResponse>>>(`${this.apiUrl}${params}`);
  }

  getById(id: number) {
    return this.http.get<ApiResponse<ApoderadoRequest>>(`${this.apiUrl}/${id}`);
  }

  registrar(data: ApoderadoRequest) {
    return this.http.post<ApiResponse<UserProfileDTO>>(this.apiUrl, data);
  }

  actualizar(id: number, data: ApoderadoRequest) {
    return this.http.put<ApiResponse<UserProfileDTO>>(`${this.apiUrl}/${id}`, data);
  }

  cambiarEstado(id: number, active: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${id}/status?active=${active}`, {});
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  getPortalPerfil() {
    return this.http.get<ApiResponse<ApoderadoRequest>>(`${environment.apiUrl}/clientes/portal/perfil`);
  }

  getPortalMascotas() {
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clientes/portal/mascotas`);
  }

  getPortalMascotasPaginated(page: number = 0, size: number = 6, nombre?: string, especie?: string, activo?: boolean) {
    let params = `?page=${page}&size=${size}`;
    if (nombre) params += `&nombre=${nombre}`;
    if (especie) params += `&especie=${especie}`;
    if (activo !== undefined && activo !== null) params += `&activo=${activo}`;
    return this.http.get<ApiResponse<Page<any>>>(`${environment.apiUrl}/clientes/portal/mascotas/paginated${params}`);
  }

  getPortalMascotaHistoria(mascotaId: number) {
    return this.http.get<ApiResponse<any>>(`${environment.apiUrl}/clientes/portal/mascotas/${mascotaId}/historia`);
  }

  getPortalCitas() {
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clientes/portal/citas`);
  }

  getPortalCitasFiltradas(mascotaId?: number) {
    const params = mascotaId ? `?mascotaId=${mascotaId}` : '';
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clientes/portal/citas${params}`);
  }

  getPortalRecetas() {
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clientes/portal/recetas`);
  }

  getPortalServicios() {
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clientes/portal/servicios`);
  }

  getPortalEmpleados(servicioId?: number) {
    const params = servicioId ? `?servicioId=${servicioId}` : '';
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clientes/portal/empleados${params}`);
  }

  getPortalDisponibilidad(empleadoId: number, fecha: string, servicioId: number) {
    return this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}/clientes/portal/disponibilidad?empleadoId=${empleadoId}&fecha=${fecha}&servicioId=${servicioId}`);
  }

  crearPortalCita(request: any) {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/clientes/portal/citas`, request);
  }

  updatePortalCita(id: number, request: any) {
    return this.http.put<ApiResponse<any>>(`${environment.apiUrl}/clientes/portal/citas/${id}`, request);
  }

  reschedulePortalCita(id: number, request: any) {
    return this.http.put<ApiResponse<any>>(`${environment.apiUrl}/clientes/portal/citas/${id}/reprogramar`, request);
  }
}
