import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  registrar(data: PagoRequest) {
    return this.http.post<ApiResponse<PagoResponse>>(this.url, data);
  }

  obtenerPorCita(citaId: number) {
    return this.http.get<ApiResponse<PagoResponse>>(`${this.url}/appointment/${citaId}`);
  }

  listarTodos(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<PagoListResponse>>>(`${this.url}?page=${page}&size=${size}`);
  }

  getMisPagos(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<PagoListResponse>>>(`${this.url}/portal/my-payments?page=${page}&size=${size}`);
  }

  getPaymentHistory(page: number = 0, size: number = 10) {
    return this.http.get<ApiResponse<Page<PagoPortalResponse>>>(`${environment.apiUrl}/clients/portal/payments?page=${page}&size=${size}`);
  }
}
