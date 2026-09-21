import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';
import { ReportesClinicos, ReportesClinicosFiltros, ReportesComparativoEmpresas, PacientesInactivosPage } from '../../models/response/reportes-clinicos-response';

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

  /** Solo para administración de plataforma: un resumen por empresa, sin mezclar sus cifras. */
  obtenerComparativoEmpresas(fechaDesde?: string, fechaHasta?: string, especie?: string) {
    let params = new HttpParams();
    if (fechaDesde) params = params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params = params.set('fechaHasta', fechaHasta);
    if (especie) params = params.set('especie', especie);
    return this.http.get<ApiResponse<ReportesComparativoEmpresas>>(`${this.apiUrl}/comparison`, { params });
  }

  /** Paginado desde el backend: no trae de una vez todas las mascotas inactivas de la empresa. */
  obtenerPacientesInactivos(companyId: number | undefined, page: number, size: number) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (companyId != null) params = params.set('companyId', companyId);
    return this.http.get<ApiResponse<PacientesInactivosPage>>(`${this.apiUrl}/inactive-patients`, { params });
  }
}
