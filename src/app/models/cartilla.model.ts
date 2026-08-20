export interface CartillaAplicacionRequest {
  mascotaId: number;
  controlPreventivoId?: number;
  servicioId: number;
  tipoVacunaId?: number;
  tipoDesparasitanteId?: number;
  producto?: string;
  fechaAplicacion: string;   // yyyy-MM-dd
  periodicidadMeses?: number;
  intervaloCantidad?: number;
  intervaloUnidad?: IntervaloUnidad;
  fechaProxima?: string;     // yyyy-MM-dd
  lote?: string;
  fechaVencimientoProducto?: string;
  dosis?: number;
  unidadDosis?: string;
  viaAdministracion?: string;
  sitioAplicacion?: string;
  pesoKg?: number;
  observaciones?: string;
}

export type IntervaloUnidad = 'DIAS' | 'SEMANAS' | 'MESES';

export interface CartillaAplicacionResponse {
  registroId: number;
  tipo: string;
  mascotaId: number;
  mascotaNombre: string;
  numeroHc: string;
  nombre: string;
  fechaAplicacion: string;
  fechaProxima: string;
  periodicidadMeses?: number;
  intervaloCantidad?: number;
  intervaloUnidad?: IntervaloUnidad;
  veterinarioNombre?: string;
  lote?: string;
  fechaVencimientoProducto?: string;
  dosis?: number;
  unidadDosis?: string;
  viaAdministracion?: string;
  sitioAplicacion?: string;
  pesoKg?: number;
  observaciones?: string;
  citaId: number;
  codigoCobro: string;
  total: number;
}

export interface AplicacionPreventiva {
  id: number;
  tipo: string;
  nombreControl: string;
  fechaAplicacion: string;
  periodicidadMeses?: number;
  intervaloCantidad?: number;
  intervaloUnidad?: IntervaloUnidad;
  fechaProximaAplicacion?: string;
  veterinarioNombre?: string;
  lote?: string;
  fechaVencimientoProducto?: string;
  dosis?: number;
  unidadDosis?: string;
  viaAdministracion?: string;
  sitioAplicacion?: string;
  pesoKg?: number;
  observaciones?: string;
}


export interface TipoVacuna {
  id: number;
  nombre: string;
  especie: string;
  periodicidadMesesSugerida?: number;
  precio: number;
}

export interface TipoDesparasitante {
  id: number;
  nombre: string;
  especie: string;
  periodicidadMesesSugerida?: number;
  precio: number;
}
