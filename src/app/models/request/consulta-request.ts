export interface ConsultaRequest {
  version: number;
  tipoConsulta?: string;
  pesoEnConsulta?: number | null;
  temperatura?: number | null;
  frecuenciaCardiaca?: number | null;
  frecuenciaRespiratoria?: number | null;
  mucosas?: string;
  turgenciaPiel?: string;
  vacunacionAplicada?: boolean;
  observacionVacunacion?: string;
  desparasitacionAplicada?: boolean;
  observacionDesparasitacion?: string;
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
