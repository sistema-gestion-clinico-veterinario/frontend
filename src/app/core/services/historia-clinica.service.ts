import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { HistoriaClinicaDetalle } from '../../models/response/historia-clinica-response';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({
  providedIn: 'root'
})
export class HistoriaClinicaService {
  private readonly http   = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/historias-clinicas`;

  getPorMascota(mascotaId: number) {
    return this.http.get<ApiResponse<HistoriaClinicaDetalle>>(`${this.apiUrl}/mascota/${mascotaId}`);
  }
}
