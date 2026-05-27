export interface ConsultaRequest {
  version: number;
  tipoConsulta?: string;
  pesoEnConsulta?: number | null;
  temperatura?: number | null;
  frecuenciaCardiaca?: number | null;
  frecuenciaRespiratoria?: number | null;
  mucosas?: string;
  turgenciaPiel?: string;
  vacunacionAlDia?: boolean;
  desparasitacionAlDia?: boolean;
  motivoConsulta?: string;
  anamnesis?: string;
  examenFisico?: string;
  observaciones?: string;
  antecedentesEnfermedades?: string;
  antecedentesProcedimientos?: string;
  antecedentesPersonales?: string;
  antecedentesFamiliares?: string;
  grupoSanguineo?: string;
  indicacionesReceta?: string;
}

export interface CerrarConsultaRequest {
  version: number;
}
