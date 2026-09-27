export interface LoteRequest {
  companyId?: number;
  productoId: number;
  numeroLote: string;
  fechaVencimiento: string;
  fechaIngreso?: string | null;
  cantidad: number;
  costoUnitario?: number | null;
}
