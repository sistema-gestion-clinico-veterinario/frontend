import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { CategoriaProductoResponse } from '../../models/response/categoria-producto-response';
import { CategoriaProductoRequest } from '../../models/request/categoria-producto-request';

@Injectable({
  providedIn: 'root'
})
export class CategoriaProductoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/categorias-producto`;

  listarActivas(companyId?: number) {
    let query = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<CategoriaProductoResponse[]>>(`${this.url}/activas${query}`);
  }

  listar(companyId?: number, page = 0, size = 20) {
    let query = `?page=${page}&size=${size}`;
    if (companyId) query += `&companyId=${companyId}`;
    return this.http.get<ApiResponse<Page<CategoriaProductoResponse>>>(`${this.url}${query}`);
  }

  crear(request: CategoriaProductoRequest) {
    return this.http.post<ApiResponse<CategoriaProductoResponse>>(this.url, request);
  }

  actualizar(id: number, request: CategoriaProductoRequest) {
    return this.http.put<ApiResponse<CategoriaProductoResponse>>(`${this.url}/${id}`, request);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`);
  }

  toggleActivo(id: number) {
    return this.http.patch<ApiResponse<CategoriaProductoResponse>>(`${this.url}/${id}/toggle`, {});
  }
}
