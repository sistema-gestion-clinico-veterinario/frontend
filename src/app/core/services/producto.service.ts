import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { ProductoResponse } from '../../models/response/producto-response';
import { ProductoRequest } from '../../models/request/producto-request';
import { CategoriaConteoResponse } from '../../models/response/categoria-conteo-response';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/productos`;

  listarActivos(companyId?: number) {
    let query = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<ProductoResponse[]>>(`${this.url}/activos${query}`);
  }

  listar(companyId?: number, page = 0, size = 20, search?: string, categoriaId?: number, activo?: boolean) {
    let query = `?page=${page}&size=${size}`;
    if (companyId) query += `&companyId=${companyId}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    if (categoriaId) query += `&categoriaId=${categoriaId}`;
    if (activo !== undefined) query += `&activo=${activo}`;
    return this.http.get<ApiResponse<Page<ProductoResponse>>>(`${this.url}${query}`);
  }

  obtener(id: number) {
    return this.http.get<ApiResponse<ProductoResponse>>(`${this.url}/${id}`);
  }

  conteoPorCategoria(companyId?: number) {
    let query = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<CategoriaConteoResponse[]>>(`${this.url}/conteo-por-categoria${query}`);
  }

  crear(request: ProductoRequest) {
    return this.http.post<ApiResponse<ProductoResponse>>(this.url, request);
  }

  actualizar(id: number, request: ProductoRequest) {
    return this.http.put<ApiResponse<ProductoResponse>>(`${this.url}/${id}`, request);
  }

  eliminar(id: number) {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`);
  }

  toggleActivo(id: number) {
    return this.http.patch<ApiResponse<ProductoResponse>>(`${this.url}/${id}/toggle`, {});
  }
}
