import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { ServicioResponse } from '../../models/response/servicio-response';
import { ServicioRequest } from '../../models/request/servicio-request';
import { tap } from 'rxjs';
import { TimedRequestCache } from '../utils/timed-request-cache';

@Injectable({
  providedIn: 'root'
})
export class ServicioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/services`;
  private readonly availableCache = new TimedRequestCache(2 * 60 * 1000);

  listarDisponibles(companyId?: number) {
    let query = companyId ? `?companyId=${companyId}` : '';
    const request = () => this.http.get<ApiResponse<ServicioResponse[]>>(`${this.url}/available${query}`);

    if (companyId == null) return request();
    return this.availableCache.get(String(companyId), request);
  }

  listar(companyId?: number, page = 0, size = 20) {
    let query = `?page=${page}&size=${size}`;
    if (companyId) query += `&companyId=${companyId}`;
    return this.http.get<ApiResponse<Page<ServicioResponse>>>(`${this.url}${query}`);
  }

  crear(request: ServicioRequest) {
    return this.http.post<ApiResponse<ServicioResponse>>(this.url, request).pipe(
      tap(() => this.availableCache.clear())
    );
  }

  actualizar(id: number, request: ServicioRequest) {
    return this.http.put<ApiResponse<ServicioResponse>>(`${this.url}/${id}`, request).pipe(
      tap(() => this.availableCache.clear())
    );
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(
      tap(() => this.availableCache.clear())
    );
  }

  toggleDisponible(id: number) {
    return this.http.patch<ApiResponse<ServicioResponse>>(`${this.url}/${id}/toggle`, {}).pipe(
      tap(() => this.availableCache.clear())
    );
  }
}
