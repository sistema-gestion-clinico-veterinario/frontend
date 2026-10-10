import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

export type AudienciaAvisoPrivacidad = 'PROPIETARIOS_Y_AUTORIZADOS' | 'TRABAJADORES_Y_USUARIOS';

export interface CamposAvisoPrivacidad {
  razonSocial: string;
  ruc: string;
  domicilio: string;
  correoDerechos: string;
  registroBancoDatos: string | null;
  encargadoTratamiento: string | null;
  finalidades: string[];
  datosObligatorios: string[];
  datosFacultativos: string[];
  destinatarios: string[];
  transferencias: string;
  plazoConservacion: string;
}

export interface AvisoPublico {
  clinica: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  audiencia: AudienciaAvisoPrivacidad;
  version: number;
  vigenteDesde: string;
  contenido: string;
}

export interface AvisoVersion {
  audiencia: AudienciaAvisoPrivacidad;
  version: number;
  contenido: string;
  contenidoHash: string;
  vigenteDesde: string;
  activo: boolean;
  creadoPor: string | null;
  creadoDispositivo: string | null;
  creadoIp: string | null;
  campos: CamposAvisoPrivacidad;
}

export interface VistaPreviaAviso {
  version: number;
  contenido: string;
  sinCambios: boolean;
  observaciones: string[];
}

export type CanalConsentimiento = 'PRESENCIAL' | 'PORTAL' | 'ACTIVACION';
export type EstadoFinalidad = 'OTORGADO' | 'RETIRADO' | 'SIN_REGISTRO';

export interface FinalidadEstado {
  codigo: string;
  descripcion: string;
  estado: EstadoFinalidad;
  fecha: string | null;
  canal: CanalConsentimiento | null;
}

export interface ConsentimientoEstado {
  avisoPublicado: boolean;
  avisoVersion: number | null;
  informada: boolean;
  informadaVersion: number | null;
  informadaFecha: string | null;
  informadaCanal: CanalConsentimiento | null;
  vistaPorLaPersona: boolean;
  finalidades: FinalidadEstado[];
}

export const RECORDATORIOS = 'RECORDATORIOS_PREVENTIVOS';
export const USO_IA = 'USO_IA_CLINICA';

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
    return this.http.get<ApiResponse<ConsentimientoEstado>>(`${this.base}/privacidad/mi-estado`);
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
