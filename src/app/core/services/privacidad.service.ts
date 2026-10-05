import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

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
  version: number;
  vigenteDesde: string;
  contenido: string;
}

export interface AvisoVersion {
  version: number;
  contenido: string;
  contenidoHash: string;
  vigenteDesde: string;
  activo: boolean;
  creadoPor: string | null;
  campos: CamposAvisoPrivacidad;
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
  finalidades: FinalidadEstado[];
}

export const RECORDATORIOS = 'RECORDATORIOS_PREVENTIVOS';

@Injectable({ providedIn: 'root' })
export class PrivacidadService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  avisoPublico(slug: string): Observable<ApiResponse<AvisoPublico>> {
    return this.http.get<ApiResponse<AvisoPublico>>(`${this.base}/public/privacidad/${encodeURIComponent(slug)}`);
  }

  avisoVigente(): Observable<ApiResponse<AvisoPublico | null>> {
    return this.http.get<ApiResponse<AvisoPublico | null>>(`${this.base}/privacidad/aviso-vigente`);
  }

  plantilla(): Observable<ApiResponse<CamposAvisoPrivacidad>> {
    return this.http.get<ApiResponse<CamposAvisoPrivacidad>>(`${this.base}/admin/privacidad/aviso/plantilla`);
  }

  historial(): Observable<ApiResponse<AvisoVersion[]>> {
    return this.http.get<ApiResponse<AvisoVersion[]>>(`${this.base}/admin/privacidad/aviso/historial`);
  }

  publicar(campos: CamposAvisoPrivacidad, confirmoRevisionLegal: boolean): Observable<ApiResponse<AvisoVersion>> {
    return this.http.post<ApiResponse<AvisoVersion>>(`${this.base}/admin/privacidad/aviso`, { campos, confirmoRevisionLegal });
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
