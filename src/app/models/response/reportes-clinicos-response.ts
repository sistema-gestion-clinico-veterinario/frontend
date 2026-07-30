export interface ItemCount {
  label: string;
  count: number;
}

export interface ProximaAplicacion {
  mascota: string;
  producto: string;
  fechaProxima: string;
  tipoControl?: string;
}

export interface ResumenReporte {
  consultas: number;
  pacientesAtendidos: number;
  ingresos: number;
  nuevosPacientes: number;
  tiempoPromedioAtencionMinutos: number;
  porcentajeCitasCompletadas: number;
}

export interface HeatmapItem {
  diaSemana: number;
  hora: number;
  count: number;
}

export interface ReportesClinicos {
  fechaDesde: string;
  fechaHasta: string;
  resumen: ResumenReporte;
  resumenAnterior: ResumenReporte;
  consultasPorTipo: ItemCount[];
  diagnosticosPorTipoYEstado: ItemCount[];
  tratamientosPorEstado: ItemCount[];
  consultasPorEstado: ItemCount[];
  pacientesPorEspecie: ItemCount[];
  pacientesPorRangoEdad: ItemCount[];
  proximasVacunas: ProximaAplicacion[];
  proximasDesparasitaciones: ProximaAplicacion[];
  consultasPorMes: ItemCount[];
  consultasPorVeterinario: ItemCount[];
  frecuenciaConsultasPorPaciente: ItemCount[];
  serviciosMasSolicitados: ItemCount[];
  controlesPreventivosProximos: ProximaAplicacion[];
  demandaPorHorario: HeatmapItem[];
}

export interface ReportesClinicosFiltros {
  companyId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  veterinarioId?: number;
  especie?: string;
}
