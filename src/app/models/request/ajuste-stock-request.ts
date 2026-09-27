export type MotivoAjusteStock = 'CONTEO_FISICO' | 'MERMA' | 'VENCIMIENTO' | 'DEVOLUCION' | 'CORRECCION' | 'OTRO';

export interface AjusteStockRequest {
  productoId: number;
  stockNuevo: number;
  motivo: MotivoAjusteStock;
  observaciones?: string;
}
