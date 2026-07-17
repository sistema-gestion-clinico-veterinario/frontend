export type TipoControlPreventivo = 'VACUNACION' | 'DESPARASITACION';
export type EstadoControlPreventivo = 'PROGRAMADO' | 'PROXIMO' | 'PENDIENTE' | 'ATRASADO' | 'APLICADO' | 'SUSPENDIDO_POR_CITA' | 'CANCELADO';

export interface TipoVacunaResponse {
  id: number;
  nombre: string;
  especie: string;
  periodicidadMesesSugerida?: number;
}

export interface ControlPreventivoResponse {
  id: number;
  mascotaId: number;
  tipo: TipoControlPreventivo;
  tipoVacunaId?: number;
  nombreControl: string;
  fechaRecomendada: string;
  estado: EstadoControlPreventivo;
  citaSuspendeId?: number;
}

export interface AplicacionPreventivaResponse {
  id: number;
  tipo: TipoControlPreventivo;
  nombreControl: string;
  fechaAplicacion: string;
  periodicidadMeses: number;
  fechaProximaAplicacion: string;
  veterinarioNombre?: string;
}
