import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { LoteResponse } from '../../models/response/lote-response';
import { LoteRequest } from '../../models/request/lote-request';
import { AlertaVencimientoResponse } from '../../models/response/alerta-vencimiento-response';

@Injectable({
  providedIn: 'root'
})
export class LoteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/lotes`;

  listar(companyId?: number, search?: string, page = 0, size = 20) {
    let query = `?page=${page}&size=${size}`;
    if (companyId) query += `&companyId=${companyId}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    return this.http.get<ApiResponse<Page<LoteResponse>>>(`${this.url}${query}`);
  }

  listarPorProducto(productoId: number, page = 0, size = 20) {
    return this.http.get<ApiResponse<Page<LoteResponse>>>(`${this.url}/producto/${productoId}?page=${page}&size=${size}`);
  }

  listarActivosPorProducto(productoId: number) {
    return this.http.get<ApiResponse<LoteResponse[]>>(`${this.url}/producto/${productoId}/activos`);
  }

  crear(request: LoteRequest) {
    return this.http.post<ApiResponse<LoteResponse>>(this.url, request);
  }

  actualizar(id: number, request: LoteRequest) {
    return this.http.put<ApiResponse<LoteResponse>>(`${this.url}/${id}`, request);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`);
  }

  toggleActivo(id: number) {
    return this.http.patch<ApiResponse<LoteResponse>>(`${this.url}/${id}/toggle`, {});
  }

  alertas(companyId?: number, dias = 30) {
    let query = `?dias=${dias}`;
    if (companyId) query += `&companyId=${companyId}`;
    return this.http.get<ApiResponse<AlertaVencimientoResponse>>(`${this.url}/alertas${query}`);
  }
}
