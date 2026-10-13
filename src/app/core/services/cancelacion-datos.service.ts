import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import {
  CancelacionDatosElegibilidad,
  RegistrarCancelacion,
  SolicitudCancelacion
} from '../../models/privacy/cancelacion-datos.model';
import { EstadoSolicitudCancelacion } from '../../types/cancelacion/estado-solicitud-cancelacion.type';

@Injectable({ providedIn: 'root' })
export class CancelacionDatosService {
  private readonly http = inject(HttpClient);
  private readonly titular = `${environment.apiUrl}/me/privacidad/cancelacion`;
  private readonly admin = `${environment.apiUrl}/admin/privacidad/cancelaciones`;

  estado(): Observable<ApiResponse<CancelacionDatosElegibilidad>> {
    return this.http.get<ApiResponse<CancelacionDatosElegibilidad>>(this.titular);
  }

  pedirCodigo(password: string | null): Observable<ApiResponse<{ retryAfterSeconds?: number }>> {
    return this.http.post<ApiResponse<{ retryAfterSeconds?: number }>>(`${this.titular}/codigo`, { password });
  }

  solicitar(code: string, motivo: string | null): Observable<ApiResponse<SolicitudCancelacion>> {
    return this.http.post<ApiResponse<SolicitudCancelacion>>(this.titular, { code, motivo });
  }

  listar(estado?: EstadoSolicitudCancelacion): Observable<ApiResponse<SolicitudCancelacion[]>> {
    const consulta = estado ? `?estado=${estado}` : '';
    return this.http.get<ApiResponse<SolicitudCancelacion[]>>(`${this.admin}${consulta}`);
  }

  registrar(solicitud: RegistrarCancelacion): Observable<ApiResponse<SolicitudCancelacion>> {
    return this.http.post<ApiResponse<SolicitudCancelacion>>(this.admin, solicitud);
  }

  ejecutar(id: number): Observable<ApiResponse<SolicitudCancelacion>> {
    return this.http.post<ApiResponse<SolicitudCancelacion>>(`${this.admin}/${id}/ejecutar`, {});
  }

  rechazar(id: number, motivo: string): Observable<ApiResponse<SolicitudCancelacion>> {
    return this.http.post<ApiResponse<SolicitudCancelacion>>(`${this.admin}/${id}/rechazar`, { motivo });
  }
}
