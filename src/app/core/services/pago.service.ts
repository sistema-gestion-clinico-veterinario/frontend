import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { PagoRequest } from '../../models/request/pago-request';
import { PagoListResponse, PagoResponse } from '../../models/response/pago-response';
import { PagoPortalResponse } from '../../models/response/pago-portal-response';
import { Page } from '../../models/response/page';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/payments`;

  registrar(data: PagoRequest, idempotencyKey: string) {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http.post<ApiResponse<PagoResponse>>(this.url, data, { headers });
  }

  reportarComprobante(pagoId: number, generated: boolean, error?: string) {
    return this.http.post<ApiResponse<PagoResponse>>(`${this.url}/${pagoId}/receipt-result`, {
      generated,
      error: error?.slice(0, 500)
    });
  }

  listarHistorialPorEmpresa(
    page: number = 0,
    size: number = 10,
    companyId?: number,
    filters: { estado?: string; metodoPago?: string } = {}
  ) {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);
    if (companyId != null) params = params.set('companyId', companyId);
    if (filters.estado) params = params.set('estado', filters.estado);
    if (filters.metodoPago) params = params.set('metodoPago', filters.metodoPago);

    return this.http.get<ApiResponse<Page<PagoListResponse>>>(`${this.url}/history`, { params });
  }

  getMisPagos(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<PagoListResponse>>>(`${this.url}/portal/my-payments?page=${page}&size=${size}`);
  }

  getPaymentHistory(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<PagoPortalResponse>>>(`${environment.apiUrl}/clients/portal/payments?page=${page}&size=${size}`);
  }
}
