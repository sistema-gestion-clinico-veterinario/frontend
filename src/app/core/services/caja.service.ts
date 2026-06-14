import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { Page } from '../../models/response/page';
import { MovimientoCajaResponse, ResumenCajaResponse } from '../../models/response/movimiento-caja-response';
import { MovimientoEgresoRequest } from '../../models/request/movimiento-egreso-request';

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http   = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/caja`;

  listar(companyId: number, desde?: string, hasta?: string, page = 0, size = 20) {
    let params = new HttpParams().set('companyId', companyId).set('page', page).set('size', size);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<ApiResponse<Page<MovimientoCajaResponse>>>(this.apiUrl, { params });
  }

  resumen(companyId: number, desde?: string, hasta?: string) {
    let params = new HttpParams().set('companyId', companyId);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<ApiResponse<ResumenCajaResponse>>(`${this.apiUrl}/resumen`, { params });
  }

  registrarEgreso(request: MovimientoEgresoRequest) {
    return this.http.post<ApiResponse<MovimientoCajaResponse>>(`${this.apiUrl}/egreso`, request);
  }

  registrarDevolucion(citaId: number) {
    return this.http.post<ApiResponse<MovimientoCajaResponse>>(`${this.apiUrl}/devolucion/${citaId}`, {});
  }
}
