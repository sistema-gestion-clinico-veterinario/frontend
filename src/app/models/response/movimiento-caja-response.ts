export interface MovimientoCajaResponse {
  id: number;
  tipo: 'INGRESO' | 'EGRESO' | 'DEVOLUCION';
  concepto: 'PAGO_CITA' | 'CANCELACION_DEVOLUCION' | 'GASTO_OPERATIVO' | 'OTRO';
  monto: number;
  citaId: number | null;
  metodoPago: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA' | null;
  descripcion: string | null;
  fecha: string;
  registradoPor: string | null;
  companyId: number;
}

export interface SesionCajaResponse {
  id: number;
  companyId: number;
  estado: 'ABIERTA' | 'CERRADA';
  montoApertura: number;
  efectivoEsperado: number;
  efectivoContado: number | null;
  diferencia: number | null;
  abiertaAt: string;
  cerradaAt: string | null;
  abiertaPor: string;
  cerradaPor: string | null;
  observaciones: string | null;
}

export interface ResumenCajaResponse {
  totalIngresos: number;
  totalEgresos: number;
  totalDevoluciones: number;
  saldo: number;
}
