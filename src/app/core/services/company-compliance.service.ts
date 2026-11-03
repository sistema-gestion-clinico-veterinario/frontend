import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { ConfiguracionCumplimiento, ControlCumplimiento, DetalleCumplimientoClinica, EstadoCumplimientoClinica, EstadoSolicitudCambioCumplimiento, ModoGestionCumplimiento, SolicitudCambioCumplimiento } from '../../models/privacy/company-compliance.model';
import { Page } from '../../models/response/page';
import { SKIP_GLOBAL_LOADING } from '../interceptors/http-context.tokens';

@Injectable({ providedIn: 'root' })
export class CompanyComplianceService {
  private readonly http = inject(HttpClient);
  actuales(companyId: number) { return this.http.get<ApiResponse<ConfiguracionCumplimiento[]>>(`${environment.apiUrl}/platform/companies/${companyId}/compliance`); }
  historial(companyId: number) { return this.http.get<ApiResponse<ConfiguracionCumplimiento[]>>(`${environment.apiUrl}/platform/companies/${companyId}/compliance/history`); }
  actualesDeMiClinica() { return this.http.get<ApiResponse<EstadoCumplimientoClinica[]>>(`${environment.apiUrl}/me/compliance`); }
  detalleDeMiClinica() { return this.http.get<ApiResponse<DetalleCumplimientoClinica[]>>(`${environment.apiUrl}/me/compliance/details`); }
  configurar(companyId: number, control: ControlCumplimiento, body: { habilitado: boolean; modo: ModoGestionCumplimiento; bloqueante: boolean; justificacion: string; referenciaContractual: string | null; confirmoRevisionLegal: boolean; vigenteDesde: string | null }) {
    return this.http.post<ApiResponse<ConfiguracionCumplimiento>>(`${environment.apiUrl}/platform/companies/${companyId}/compliance/${control}`, body);
  }
  solicitudesDeMiClinica() {
    return this.http.get<ApiResponse<SolicitudCambioCumplimiento[]>>(`${environment.apiUrl}/me/compliance/requests`);
  }
  solicitarCambio(body: { control: ControlCumplimiento; habilitado: boolean; modo: ModoGestionCumplimiento; bloqueante: boolean; motivo: string; evidenciaReferencia: string | null; vigenteDesde: string | null }) {
    return this.http.post<ApiResponse<SolicitudCambioCumplimiento>>(`${environment.apiUrl}/me/compliance/requests`, body);
  }
  solicitudesPendientes(companyId: number) {
    return this.http.get<ApiResponse<SolicitudCambioCumplimiento[]>>(`${environment.apiUrl}/platform/companies/${companyId}/compliance/requests`);
  }
  resolverSolicitud(id: number, body: { aprobar: boolean; comentario: string; confirmoRevisionLegal: boolean }) {
    return this.http.put<ApiResponse<SolicitudCambioCumplimiento>>(`${environment.apiUrl}/platform/compliance/requests/${id}`, body);
  }
  iniciarRevision(id: number) {
    return this.http.put<ApiResponse<SolicitudCambioCumplimiento>>(`${environment.apiUrl}/platform/compliance/requests/${id}/review`, {});
  }
  bandejaGlobal(filtros: { companyId?: number | null; control?: ControlCumplimiento | ''; estado?: EstadoSolicitudCambioCumplimiento | ''; desde?: string; hasta?: string; page?: number; size?: number }, skipGlobalLoading = false) {
    let params = new HttpParams()
      .set('page', String(filtros.page ?? 0))
      .set('size', String(filtros.size ?? 10));
    if (filtros.companyId) params = params.set('companyId', String(filtros.companyId));
    if (filtros.control) params = params.set('control', filtros.control);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    const context = skipGlobalLoading ? new HttpContext().set(SKIP_GLOBAL_LOADING, true) : undefined;
    return this.http.get<ApiResponse<Page<SolicitudCambioCumplimiento>>>(`${environment.apiUrl}/platform/compliance/requests`, { params, context });
  }
  contarSolicitudesActivas() {
    return this.http.get<ApiResponse<number>>(`${environment.apiUrl}/platform/compliance/requests/pending-count`, {
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
    });
  }
  notificacionesDeMiClinica() {
    return this.http.get<ApiResponse<SolicitudCambioCumplimiento[]>>(`${environment.apiUrl}/me/compliance/request-notifications`, {
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
    });
  }
  marcarDecisionVista(id: number) {
    return this.http.put<ApiResponse<void>>(`${environment.apiUrl}/me/compliance/requests/${id}/seen`, {}, {
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
    });
  }
}
