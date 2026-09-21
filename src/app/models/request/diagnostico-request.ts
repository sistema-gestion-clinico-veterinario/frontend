export type TipoDiagnostico = 'PRESUNTIVO' | 'DEFINITIVO' | 'DIFERENCIAL' | 'OTRO';
export type EstadoDiagnostico = 'ACTIVO' | 'RESUELTO' | 'CRONICO' | 'EN_SEGUIMIENTO' | 'OTRO';

export interface DiagnosticoRequest {
  nombre: string;
  codigoCIE?: string;
  descripcion?: string;
  tipo: TipoDiagnostico;
  estado: EstadoDiagnostico;
  fechaProximoControl?: string;
}
