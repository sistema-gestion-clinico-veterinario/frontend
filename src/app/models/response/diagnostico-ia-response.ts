export interface DiagnosticoIaRequest {
  mascotaNombre: string;
  especie?: string;
  raza?: string;
  edadMeses?: number;
  totalConsultas: number;
  ultimaConsulta: {
    fecha: string;
    motivo: string;
    tipo: string;
    pesoKg?: number;
    temperatura?: number;
    frecuenciaCardiaca?: number;
    frecuenciaRespiratoria?: number;
    anamnesis?: string;
    examenFisico?: string;
    observaciones?: string;
    diagnosticosRegistrados: string[];
    tratamientosRegistrados: string[];
    medicamentos: string[];
    tieneHemograma: boolean;
    tieneRadiografia: boolean;
    tieneEcografia: boolean;
  };
}

export interface DiagnosticoIaResponse {
  diagnosticoPrincipal: string;
  hallazgosClaves: string[];
  recomendaciones: string[];
  nivelConfianza: 'ALTO' | 'MEDIO' | 'BAJO';
  basadoEn: string[];
}
