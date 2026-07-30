import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { ReportesClinicos, ReportesClinicosFiltros } from '../../models/response/reportes-clinicos-response';

@Injectable({
  providedIn: 'root'
})
export class ReportesClinicosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clinical-reports`;

  obtenerReportes(filtros: ReportesClinicosFiltros) {
    let params = new HttpParams();
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.companyId != null) params = params.set('companyId', filtros.companyId);
    if (filtros.veterinarioId != null) params = params.set('veterinarioId', filtros.veterinarioId);
    if (filtros.especie) params = params.set('especie', filtros.especie);
    return this.http.get<ApiResponse<ReportesClinicos>>(this.apiUrl, { params });
  }
}
