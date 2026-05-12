import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  DiagnosticoIaRequest,
  DiagnosticoIaResponse
} from '../../models/response/diagnostico-ia-response';
import { ApiResponse } from '../../models/response/api-response';

@Injectable({ providedIn: 'root' })
export class DiagnosticoIaService {
  private readonly http = inject(HttpClient);
  private readonly iaUrl = `${environment.apiUrl}/ia/diagnostico`;

  /**
   * Envía los datos clínicos al modelo de lenguaje y obtiene un diagnóstico asistido.
   * Mientras el endpoint de IA no esté disponible, se utiliza la respuesta simulada.
   */
  analizar(request: DiagnosticoIaRequest): Observable<DiagnosticoIaResponse> {
    // TODO: descomentar cuando el backend IA esté listo:
    // return this.http.post<ApiResponse<DiagnosticoIaResponse>>(this.iaUrl, request)
    //   .pipe(map(r => r.data));

    return of(this.generarRespuestaSimulada(request)).pipe(delay(2400));
  }

  private generarRespuestaSimulada(req: DiagnosticoIaRequest): DiagnosticoIaResponse {
    const uc = req.ultimaConsulta;
    const basadoEn: string[] = ['Datos de última consulta'];
    if (req.totalConsultas > 1) basadoEn.push(`${req.totalConsultas} consultas históricas`);
    if (uc.tieneHemograma)   basadoEn.push('Hemograma adjunto');
    if (uc.tieneRadiografia) basadoEn.push('Radiografía adjunta');
    if (uc.tieneEcografia)   basadoEn.push('Ecografía adjunta');

    const diagnosticosBase = uc.diagnosticosRegistrados.length > 0
      ? uc.diagnosticosRegistrados[0]
      : 'proceso inflamatorio inespecífico';

    const hallazgos: string[] = [];
    if (uc.temperatura && uc.temperatura > 39.5)
      hallazgos.push(`Temperatura elevada (${uc.temperatura} °C) — posible respuesta febril`);
    if (uc.frecuenciaCardiaca && uc.frecuenciaCardiaca > 140)
      hallazgos.push(`Frecuencia cardíaca aumentada (${uc.frecuenciaCardiaca} lpm)`);
    if (uc.pesoKg) hallazgos.push(`Peso registrado: ${uc.pesoKg} kg`);
    if (uc.anamnesis) hallazgos.push('Anamnesis documentada disponible para contexto');
    if (uc.tieneHemograma) hallazgos.push('Perfil hematológico adjunto — revisar leucograma y serie roja');
    if (uc.tieneRadiografia) hallazgos.push('Imagen radiológica disponible — valorar estructuras óseas y tejidos blandos');
    if (uc.tieneEcografia)   hallazgos.push('Ecografía adjunta — evaluar órganos abdominales');
    if (hallazgos.length === 0) hallazgos.push('Signos vitales sin alteraciones evidentes en los datos registrados');

    const recomendaciones: string[] = [
      `Correlacionar el diagnóstico de ${diagnosticosBase} con la evolución clínica del paciente`,
    ];
    if (uc.medicamentos.length > 0)
      recomendaciones.push(`Verificar adherencia y respuesta al tratamiento con ${uc.medicamentos.slice(0, 2).join(', ')}`);
    if (uc.tieneHemograma)
      recomendaciones.push('Interpretar los valores hematológicos en conjunto con los signos clínicos observados');
    if (req.totalConsultas > 2)
      recomendaciones.push('Considerar evolución cronológica de las consultas previas para evaluar progresión');
    recomendaciones.push('Esta sugerencia es orientativa — el diagnóstico definitivo corresponde al médico veterinario');

    const nivelConfianza: DiagnosticoIaResponse['nivelConfianza'] =
      (uc.tieneHemograma || uc.tieneRadiografia) && uc.diagnosticosRegistrados.length > 0
        ? 'ALTO'
        : uc.diagnosticosRegistrados.length > 0 || uc.anamnesis
          ? 'MEDIO'
          : 'BAJO';

    return {
      diagnosticoPrincipal: `Compatible con ${diagnosticosBase}${uc.tieneHemograma ? ', soportado por perfil hematológico' : ''}`,
      hallazgosClaves: hallazgos,
      recomendaciones,
      nivelConfianza,
      basadoEn
    };
  }
}
