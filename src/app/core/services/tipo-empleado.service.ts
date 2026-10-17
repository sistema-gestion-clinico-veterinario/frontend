import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { tap } from 'rxjs';
import { TimedRequestCache } from '../utils/timed-request-cache';

@Injectable({
  providedIn: 'root'
})
export class TipoEmpleadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/employee-types`;
  private readonly cache = new TimedRequestCache(5 * 60 * 1000);

  listar(companyId?: number, page = 0, size = 10) {
    let params = `?page=${page}&size=${size}`;
    if (companyId) params += `&companyId=${companyId}`;
    const request = () => this.http.get<ApiResponse<Page<any>>>(`${this.apiUrl}${params}`);

    if (companyId == null) return request();
    return this.cache.get(`${companyId}:${page}:${size}`, request);
  }

  crear(data: { nombre: string; descripcion?: string; permiteEspecialidades?: boolean; esVeterinario?: boolean; company?: { id: number } }) {
    return this.http.post<ApiResponse<any>>(this.apiUrl, data).pipe(tap(() => this.cache.clear()));
  }

  actualizar(id: number, data: { nombre: string; descripcion?: string; permiteEspecialidades?: boolean; esVeterinario?: boolean; company?: { id: number } }) {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/${id}`, data).pipe(tap(() => this.cache.clear()));
  }

  cambiarEstado(id: number, activo: boolean) {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${id}/status?active=${activo}`, {}).pipe(
      tap(() => this.cache.clear())
    );
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(tap(() => this.cache.clear()));
  }
}
