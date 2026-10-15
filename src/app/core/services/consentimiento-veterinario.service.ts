import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { ConsentimientoVeterinario, CrearConsentimientoVeterinario, EstadoConsentimientoVeterinario } from '../../models/privacy/consentimiento-veterinario.model';

@Injectable({ providedIn: 'root' })
export class ConsentimientoVeterinarioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/consentimientos-veterinarios`;
  private readonly mio = `${environment.apiUrl}/me/consentimientos-veterinarios`;

  listar(mascotaId?: number, estado?: EstadoConsentimientoVeterinario) {
    let params = new HttpParams();
    if (mascotaId) params = params.set('mascotaId', mascotaId);
    if (estado) params = params.set('estado', estado);
    return this.http.get<ApiResponse<ConsentimientoVeterinario[]>>(this.base, { params });
  }
  crear(request: CrearConsentimientoVeterinario) {
    return this.http.post<ApiResponse<ConsentimientoVeterinario>>(this.base, request);
  }
  listarMios() { return this.http.get<ApiResponse<ConsentimientoVeterinario[]>>(this.mio); }
  decidir(uuid: string, request: { aceptar: boolean; nombreFirmante: string; documentoFirmante: string; preguntasAclaradas: boolean; motivoRechazo: string | null }) {
    return this.http.post<ApiResponse<ConsentimientoVeterinario>>(`${this.mio}/${uuid}/decision`, request);
  }
  revocarMio(uuid: string, motivo: string) {
    return this.http.post<ApiResponse<ConsentimientoVeterinario>>(`${this.mio}/${uuid}/revocar`, { motivo });
  }
  revocar(uuid: string, motivo: string) {
    return this.http.post<ApiResponse<ConsentimientoVeterinario>>(`${this.base}/${uuid}/revocar`, { motivo });
  }
}
