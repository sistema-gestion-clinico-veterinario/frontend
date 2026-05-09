import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { PagoRequest } from '../../models/request/pago-request';
import { PagoResponse } from '../../models/response/pago-response';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pagos`;

  registrar(data: PagoRequest) {
    return this.http.post<ApiResponse<PagoResponse>>(this.url, data);
  }

  obtenerPorCita(citaId: number) {
    return this.http.get<ApiResponse<PagoResponse>>(`${this.url}/cita/${citaId}`);
  }
}
