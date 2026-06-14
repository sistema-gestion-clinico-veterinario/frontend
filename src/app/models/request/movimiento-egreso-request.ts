export interface MovimientoEgresoRequest {
  monto: number;
  descripcion: string;
  companyId: number;
  concepto?: 'GASTO_OPERATIVO' | 'OTRO';
}
