export interface MovimientoCajaResponse {
  id: number;
  tipo: 'INGRESO' | 'EGRESO' | 'DEVOLUCION';
  concepto: 'PAGO_CITA' | 'CANCELACION_DEVOLUCION' | 'GASTO_OPERATIVO' | 'OTRO';
  monto: number;
  citaId: number | null;
  descripcion: string | null;
  fecha: string;
  registradoPor: string | null;
  companyId: number;
}

export interface ResumenCajaResponse {
  totalIngresos: number;
  totalEgresos: number;
  totalDevoluciones: number;
  saldo: number;
}
