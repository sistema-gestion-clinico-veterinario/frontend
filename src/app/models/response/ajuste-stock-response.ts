import { MotivoAjusteStock } from '../request/ajuste-stock-request';

export interface AjusteStockResponse {
  id: number;
  productoId: number;
  productoNombre: string;
  productoSku: string;
  stockAnterior: number;
  stockNuevo: number;
  diferencia: number;
  motivo: MotivoAjusteStock;
  observaciones?: string;
  createdAt: string;
  createdBy?: string;
}
