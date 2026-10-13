export interface RegistroVacunacionPayload {
  controlPreventivoId?: number;
  tipoVacunaId: number;
  fechaAplicacion: string;
  periodicidadMeses: number;
  fechaProximaDosis?: string;
}

export interface RegistroDesparasitacionPayload {
  controlPreventivoId?: number;
  producto: string;
  fechaAplicacion: string;
  periodicidadMeses: number;
  fechaProximaAplicacion?: string;
}
