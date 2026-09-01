import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { ApoderadoListResponse } from '../../models/response/apoderado-list-response';
import { environment } from '../../../environments/environment';
import { ApoderadoRequest } from '../../models/request/apoderado-request';
import { UserProfileDTO } from '../../models/response/user-profile-dto';
import { SKIP_GLOBAL_LOADING } from '../interceptors/api.interceptor';

@Injectable({
  providedIn: 'root'
})
export class ApoderadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clients/guardians`;

  listar(companyId?: number, nombre?: string, numeroDocumento?: string, page: number = 0, size: number = 10, skipLoading: boolean = false) {
    let params = `?page=${page}&size=${size}`;
    if (companyId !== undefined && companyId !== null) {
      params += `&companyId=${companyId}`;
    }
    if (nombre) params += `&nombre=${encodeURIComponent(nombre)}`;
    if (numeroDocumento) params += `&numeroDocumento=${encodeURIComponent(numeroDocumento)}`;

    const context = skipLoading ? new HttpContext().set(SKIP_GLOBAL_LOADING, true) : undefined;
    return this.http.get<ApiResponse<Page<ApoderadoListResponse>>>(`${this.apiUrl}${params}`, { context });
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
    return this.http.get<ApiResponse<ApoderadoRequest>>(`${environment.apiUrl}/clients/portal/profile`);
  }

  getPortalMascotas() {
    const context = new HttpContext().set(SKIP_GLOBAL_LOADING, true);
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clients/portal/pets`, { context });
  }

  getPortalMascotasPaginated(page: number = 0, size: number = 6, nombre?: string, especie?: string, activo?: boolean) {
    let params = `?page=${page}&size=${size}`;
    if (nombre) params += `&nombre=${nombre}`;
    if (especie) params += `&especie=${especie}`;
    if (activo !== undefined && activo !== null) params += `&activo=${activo}`;
    const context = new HttpContext().set(SKIP_GLOBAL_LOADING, true);
    return this.http.get<ApiResponse<Page<any>>>(`${environment.apiUrl}/clients/portal/pets/paginated${params}`, { context });
  }

  getPortalMascotaHistoria(mascotaId: number) {
    const context = new HttpContext().set(SKIP_GLOBAL_LOADING, true);
    return this.http.get<ApiResponse<any>>(`${environment.apiUrl}/clients/portal/pets/${mascotaId}/medical-record`, { context });
  }

  getPortalCitas() {
    return this.http.get<ApiResponse<Page<any>>>(`${environment.apiUrl}/clients/portal/appointments`);
  }

  getPortalCitasFiltradas(mascotaId?: number, page: number = 0, size: number = 10) {
    let params = `?page=${page}&size=${size}`;
    if (mascotaId) params += `&mascotaId=${mascotaId}`;
    return this.http.get<ApiResponse<Page<any>>>(`${environment.apiUrl}/clients/portal/appointments${params}`);
  }

  getPortalRecetas() {
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clients/portal/prescriptions`);
  }

  getPortalServicios() {
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clients/portal/services`);
  }

  getPortalEmpleados(servicioId?: number) {
    const params = servicioId ? `?servicioId=${servicioId}` : '';
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clients/portal/employees${params}`);
  }

  getPortalEmpleadoHorario(empleadoId: number) {
    return this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/clients/portal/employees/${empleadoId}/schedule`);
  }

  getPortalDisponibilidad(empleadoId: number, fecha: string, servicioId: number) {
    return this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}/clients/portal/availability?empleadoId=${empleadoId}&fecha=${fecha}&servicioId=${servicioId}`);
  }

  crearPortalCita(request: any) {
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/clients/portal/appointments`, request);
  }

  updatePortalCita(id: number, request: any) {
    return this.http.put<ApiResponse<any>>(`${environment.apiUrl}/clients/portal/appointments/${id}`, request);
  }

  reschedulePortalCita(id: number, request: any) {
    return this.http.put<ApiResponse<any>>(`${environment.apiUrl}/clients/portal/appointments/${id}/reschedule`, request);
  }

  cancelarPortalCita(id: number, motivo: string) {
    return this.http.delete<ApiResponse<void>>(`${environment.apiUrl}/clients/portal/appointments/${id}/cancel?motivo=${encodeURIComponent(motivo)}`);
  }
}
