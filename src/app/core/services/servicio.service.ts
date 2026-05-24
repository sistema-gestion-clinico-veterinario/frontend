import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { ServicioResponse } from '../../models/response/servicio-response';
import { ServicioRequest } from '../../models/request/servicio-request';

@Injectable({
  providedIn: 'root'
})
export class ServicioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/services`;

  listarDisponibles(companyId?: number) {
    let query = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<ServicioResponse[]>>(`${this.url}/available${query}`);
  }

  listar(companyId?: number, page = 0, size = 20) {
    let query = `?page=${page}&size=${size}`;
    if (companyId) query += `&companyId=${companyId}`;
    return this.http.get<ApiResponse<Page<ServicioResponse>>>(`${this.url}${query}`);
  }

  crear(request: ServicioRequest) {
    return this.http.post<ApiResponse<ServicioResponse>>(this.url, request);
  }

  actualizar(id: number, request: ServicioRequest) {
    return this.http.put<ApiResponse<ServicioResponse>>(`${this.url}/${id}`, request);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`);
  }

  toggleDisponible(id: number) {
    return this.http.patch<ApiResponse<ServicioResponse>>(`${this.url}/${id}/toggle`, {});
  }
}
