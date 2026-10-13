import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import {
  AvisoPublico,
  AvisoVersion,
  CamposAvisoPrivacidad,
  ConsentimientoEstado,
  VistaPreviaAviso
} from '../../models/privacy/privacidad.model';
import { AudienciaAvisoPrivacidad } from '../../types/privacy/audiencia-aviso-privacidad.type';
import { SKIP_GLOBAL_LOADING } from '../interceptors/http-context.tokens';

@Injectable({ providedIn: 'root' })
export class PrivacidadService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  avisoPublico(slug: string, audiencia: AudienciaAvisoPrivacidad = 'PROPIETARIOS_Y_AUTORIZADOS'): Observable<ApiResponse<AvisoPublico>> {
    return this.http.get<ApiResponse<AvisoPublico>>(
      `${this.base}/public/privacidad/${encodeURIComponent(slug)}`, { params: { audiencia } });
  }

  avisoPublicoVersion(slug: string, version: number,
                      audiencia: AudienciaAvisoPrivacidad): Observable<ApiResponse<AvisoPublico>> {
    return this.http.get<ApiResponse<AvisoPublico>>(
      `${this.base}/public/privacidad/${encodeURIComponent(slug)}/version/${version}`,
      { params: { audiencia } });
  }

  avisoVigente(audiencia?: AudienciaAvisoPrivacidad): Observable<ApiResponse<AvisoPublico | null>> {
    return this.http.get<ApiResponse<AvisoPublico | null>>(
      `${this.base}/privacidad/aviso-vigente`, audiencia ? { params: { audiencia } } : {});
  }

  plantilla(audiencia: AudienciaAvisoPrivacidad = 'PROPIETARIOS_Y_AUTORIZADOS'): Observable<ApiResponse<CamposAvisoPrivacidad>> {
    return this.http.get<ApiResponse<CamposAvisoPrivacidad>>(
      `${this.base}/admin/privacidad/aviso/plantilla`, { params: { audiencia } });
  }

  historial(audiencia: AudienciaAvisoPrivacidad = 'PROPIETARIOS_Y_AUTORIZADOS'): Observable<ApiResponse<AvisoVersion[]>> {
    return this.http.get<ApiResponse<AvisoVersion[]>>(
      `${this.base}/admin/privacidad/aviso/historial`, { params: { audiencia } });
  }

  vistaPrevia(campos: CamposAvisoPrivacidad,
              audiencia: AudienciaAvisoPrivacidad = 'PROPIETARIOS_Y_AUTORIZADOS'): Observable<ApiResponse<VistaPreviaAviso>> {
    return this.http.post<ApiResponse<VistaPreviaAviso>>(
      `${this.base}/admin/privacidad/aviso/vista-previa`, { audiencia, campos });
  }

  publicar(campos: CamposAvisoPrivacidad, confirmoRevisionLegal: boolean,
           audiencia: AudienciaAvisoPrivacidad = 'PROPIETARIOS_Y_AUTORIZADOS'): Observable<ApiResponse<AvisoVersion>> {
    return this.http.post<ApiResponse<AvisoVersion>>(
      `${this.base}/admin/privacidad/aviso`, { audiencia, campos, confirmoRevisionLegal });
  }

  miEstado(): Observable<ApiResponse<ConsentimientoEstado>> {
    return this.http.get<ApiResponse<ConsentimientoEstado>>(
      `${this.base}/privacidad/mi-estado`,
      { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) }
    );
  }

  leiElAviso(): Observable<ApiResponse<ConsentimientoEstado>> {
    return this.http.post<ApiResponse<ConsentimientoEstado>>(`${this.base}/privacidad/enterado`, {});
  }

  decidir(finalidad: string, otorgar: boolean, motivo?: string): Observable<ApiResponse<ConsentimientoEstado>> {
    return this.http.put<ApiResponse<ConsentimientoEstado>>(
      `${this.base}/privacidad/finalidades/${finalidad}`, { otorgar, motivo: motivo ?? null });
  }

  estadoDelCliente(apoderadoId: number): Observable<ApiResponse<ConsentimientoEstado>> {
    return this.http.get<ApiResponse<ConsentimientoEstado>>(`${this.base}/clients/guardians/${apoderadoId}/privacidad`);
  }

  informarAlCliente(apoderadoId: number): Observable<ApiResponse<ConsentimientoEstado>> {
    return this.http.post<ApiResponse<ConsentimientoEstado>>(`${this.base}/clients/guardians/${apoderadoId}/privacidad/enterado`, {});
  }

  decidirPorElCliente(apoderadoId: number, finalidad: string, otorgar: boolean, motivo?: string): Observable<ApiResponse<ConsentimientoEstado>> {
    return this.http.put<ApiResponse<ConsentimientoEstado>>(
      `${this.base}/clients/guardians/${apoderadoId}/privacidad/finalidades/${finalidad}`, { otorgar, motivo: motivo ?? null });
  }
}
