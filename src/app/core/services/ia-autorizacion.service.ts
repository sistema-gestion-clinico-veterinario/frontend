import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { AutorizacionIa } from '../../models/response/autorizacion-ia-response';

export const IA_SIN_AUTORIZACION = 'IA_SIN_AUTORIZACION';

export function esErrorDeAutorizacionIa(error: any): boolean {
  if (error?.status !== 403) return false;
  const cuerpo = typeof error.error === 'string' ? parsear(error.error) : error.error;
  return cuerpo?.data?.code === IA_SIN_AUTORIZACION;
}

function parsear(texto: string): any {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class IaAutorizacionService {
  private readonly http = inject(HttpClient);

  autorizacion(mascotaId: number): Observable<ApiResponse<AutorizacionIa>> {
    return this.http.get<ApiResponse<AutorizacionIa>>(`${environment.apiUrl}/ia/autorizacion/mascotas/${mascotaId}`);
  }
}
