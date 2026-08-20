export interface CartillaAplicacionRequest {
  mascotaId: number;
  empleadoId?: number;
  servicioId: number;
  tipoVacunaId?: number;
  tipoDesparasitanteId?: number;
  producto?: string;
  fechaAplicacion: string;   // yyyy-MM-dd
  periodicidadMeses: number;
  fechaProxima?: string;     // yyyy-MM-dd
  total?: number;
}

export interface CartillaAplicacionResponse {
  registroId: number;
  tipo: string;
  mascotaId: number;
  mascotaNombre: string;
  numeroHc: string;
  nombre: string;
  fechaAplicacion: string;
  fechaProxima: string;
  periodicidadMeses: number;
  veterinarioNombre?: string;
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
  fechaProximaAplicacion?: string;
  veterinarioNombre?: string;
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