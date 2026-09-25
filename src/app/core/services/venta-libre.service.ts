import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { VentaLibreResponse } from '../../models/response/venta-libre-response';
import { VentaLibreRequest } from '../../models/request/venta-libre-request';

@Injectable({
  providedIn: 'root'
})
export class VentaLibreService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/ventas-libres`;

  registrar(request: VentaLibreRequest) {
    return this.http.post<ApiResponse<VentaLibreResponse>>(this.url, request);
  }
}
