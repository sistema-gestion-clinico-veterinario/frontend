import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { UnidadMedidaResponse } from '../../models/response/unidad-medida-response';
import { UnidadMedidaRequest } from '../../models/request/unidad-medida-request';

@Injectable({
  providedIn: 'root'
})
export class UnidadMedidaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/unidades-medida`;

  listarActivas(companyId?: number) {
    let query = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<UnidadMedidaResponse[]>>(`${this.url}/activas${query}`);
  }

  listar(companyId?: number, page = 0, size = 20, search = '', activo?: boolean) {
    let query = `?page=${page}&size=${size}`;
    if (companyId) query += `&companyId=${companyId}`;
    if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
    if (activo !== undefined) query += `&activo=${activo}`;
    return this.http.get<ApiResponse<Page<UnidadMedidaResponse>>>(`${this.url}${query}`);
  }

  crear(request: UnidadMedidaRequest) {
    return this.http.post<ApiResponse<UnidadMedidaResponse>>(this.url, request);
  }

  actualizar(id: number, request: UnidadMedidaRequest) {
    return this.http.put<ApiResponse<UnidadMedidaResponse>>(`${this.url}/${id}`, request);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`);
  }

  toggleActivo(id: number) {
    return this.http.patch<ApiResponse<UnidadMedidaResponse>>(`${this.url}/${id}/toggle`, {});
  }
}
