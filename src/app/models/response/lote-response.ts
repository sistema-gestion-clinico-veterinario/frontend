export interface LoteResponse {
  id: number;
  companyId: number;
  companyName: string;
  productoId: number;
  productoNombre: string;
  productoSku: string;
  numeroLote: string;
  fechaVencimiento: string;
  fechaIngreso?: string;
  cantidad: number;
  costoUnitario?: number;
  activo: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}
