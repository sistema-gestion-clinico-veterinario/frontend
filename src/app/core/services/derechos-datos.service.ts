import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { EstadoSolicitudDerecho, SolicitudDerechoDatos, TipoDerechoDatos } from '../../models/privacy/derechos-datos.model';

@Injectable({ providedIn: 'root' })
export class DerechosDatosService {
  private readonly http = inject(HttpClient);
  private readonly titular = `${environment.apiUrl}/me/privacidad/derechos`;
  private readonly admin = `${environment.apiUrl}/admin/privacidad/derechos`;

  listarMias() { return this.http.get<ApiResponse<SolicitudDerechoDatos[]>>(this.titular); }
  crear(tipo: TipoDerechoDatos, descripcion: string, datoRectificar: string | null) {
    return this.http.post<ApiResponse<SolicitudDerechoDatos>>(this.titular, { tipo, descripcion, datoRectificar });
  }
  listar(estado?: EstadoSolicitudDerecho) {
    const params = estado ? new HttpParams().set('estado', estado) : undefined;
    return this.http.get<ApiResponse<SolicitudDerechoDatos[]>>(this.admin, { params });
  }
  actualizar(id: number, estado: EstadoSolicitudDerecho, respuesta: string | null, motivoRechazo: string | null) {
    return this.http.put<ApiResponse<SolicitudDerechoDatos>>(`${this.admin}/${id}`, { estado, respuesta, motivoRechazo });
  }
}
