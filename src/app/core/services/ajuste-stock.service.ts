import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { AjusteStockResponse } from '../../models/response/ajuste-stock-response';
import { AjusteStockRequest } from '../../models/request/ajuste-stock-request';

@Injectable({
  providedIn: 'root'
})
export class AjusteStockService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/ajustes-stock`;

  listarPorProducto(productoId: number, page = 0, size = 20) {
    return this.http.get<ApiResponse<Page<AjusteStockResponse>>>(`${this.url}/producto/${productoId}?page=${page}&size=${size}`);
  }

  ajustar(request: AjusteStockRequest) {
    return this.http.post<ApiResponse<AjusteStockResponse>>(this.url, request);
  }
}
