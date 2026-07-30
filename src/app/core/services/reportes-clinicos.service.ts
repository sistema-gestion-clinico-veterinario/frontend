import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../models/response/api-response';

export interface ItemCount {
  label: string;
  count: number;
}

export interface ProximaAplicacion {
  mascota: string;
  producto: string;
  fechaProxima: string;
}

export interface ReportesClinicos {
  consultasPorTipo: ItemCount[];
  diagnosticosPorTipoYEstado: ItemCount[];
  tratamientosPorEstado: ItemCount[];
  consultasPorEstado: ItemCount[];
  pacientesPorEspecie: ItemCount[];
  pacientesPorRangoEdad: ItemCount[];
  proximasVacunas: ProximaAplicacion[];
  proximasDesparasitaciones: ProximaAplicacion[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportesClinicosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clinical-reports`;

  obtenerReportes(companyId?: number) {
    const params = companyId ? `?companyId=${companyId}` : '';
    return this.http.get<ApiResponse<ReportesClinicos>>(`${this.apiUrl}${params}`);
  }
}
