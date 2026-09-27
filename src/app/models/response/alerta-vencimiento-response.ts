import { LoteResponse } from './lote-response';

export interface AlertaVencimientoResponse {
  vencidosCount: number;
  porVencerCount: number;
  vencidos: LoteResponse[];
  porVencer: LoteResponse[];
}
