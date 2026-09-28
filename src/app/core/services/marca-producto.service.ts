import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { MarcaProductoRequest } from '../../models/request/marca-producto-request';
import { MarcaProductoResponse } from '../../models/response/marca-producto-response';

@Injectable({ providedIn: 'root' })
export class MarcaProductoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/marcas-producto`;

  listar(companyId?: number, page = 0, size = 20, search = '', activo?: boolean) {
    let query = `?page=${page}&size=${size}`;
    if (companyId) query += `&companyId=${companyId}`;
    if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
    if (activo !== undefined) query += `&activo=${activo}`;
    return this.http.get<ApiResponse<Page<MarcaProductoResponse>>>(`${this.url}${query}`);
  }

  listarActivas(companyId?: number) {
    const query = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<MarcaProductoResponse[]>>(`${this.url}/activas${query}`);
  }

  crear(request: MarcaProductoRequest) {
    return this.http.post<ApiResponse<MarcaProductoResponse>>(this.url, request);
  }

  actualizar(id: number, request: MarcaProductoRequest) {
    return this.http.put<ApiResponse<MarcaProductoResponse>>(`${this.url}/${id}`, request);
  }

  toggleActivo(id: number) {
    return this.http.patch<ApiResponse<MarcaProductoResponse>>(`${this.url}/${id}/toggle`, {});
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`);
  }
}
