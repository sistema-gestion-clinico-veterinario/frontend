import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

export type EstadoSolicitudCancelacion = 'PENDIENTE' | 'EJECUTADA' | 'RECHAZADA';
export type CanalSolicitudCancelacion = 'TITULAR' | 'ADMINISTRADOR';

export interface SolicitudCancelacion {
  id: number;
  estado: EstadoSolicitudCancelacion;
  canal: CanalSolicitudCancelacion;
  identidadVerificada: boolean;
  metodoVerificacion: string;
  motivoTitular: string | null;
  creadaAt: string;
  fechaLimite: string;
  vencida: boolean;
  resueltaAt: string | null;
  motivoResolucion: string | null;
  titularNombre: string | null;
  titularCorreo: string | null;
  titularDocumento: string | null;
  puedeEjecutarse: boolean;
  impedimento: string | null;
}

export interface CancelacionDatosElegibilidad {
  puedeSolicitar: boolean;
  motivoBloqueo: string | null;
  requierePassword: boolean;
  solicitudVigente: SolicitudCancelacion | null;
}

export interface RegistrarCancelacion {
  apoderadoId: number;
  metodoVerificacion: string;
  motivo?: string | null;
}

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
