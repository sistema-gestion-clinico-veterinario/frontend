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
  /** null cuando el usuario no tiene permiso VISTA_PAGOS: el dato financiero no se expone. */
  ingresos: number | null;
  nuevosPacientes: number;
  tiempoPromedioAtencionMinutos: number;
  porcentajeCitasCompletadas: number;
}

export interface HeatmapItem {
  diaSemana: number;
  hora: number;
  count: number;
}

export interface ItemMonto {
  label: string;
  monto: number;
}

/**
 * Cada sección puede venir en `null` cuando el usuario no tiene el permiso de dominio
 * correspondiente (VISTA_CITAS, VISTA_PAGOS, VISTA_MASCOTAS, VISTA_CONTROL_PREVENTIVO) — el
 * backend simplemente omite la sección en vez de calcularla. Distinto de un arreglo vacío `[]`,
 * que significa "tiene permiso, pero no hay datos para el periodo filtrado".
 */
export interface ReportesClinicos {
  fechaDesde: string;
  fechaHasta: string;
  resumen: ResumenReporte;
  resumenAnterior: ResumenReporte;
  consultasPorTipo: ItemCount[] | null;
  consultasPorEstado: ItemCount[] | null;
  pacientesPorEspecie: ItemCount[] | null;
  pacientesPorRangoEdad: ItemCount[] | null;
  proximasVacunas: ProximaAplicacion[] | null;
  proximasDesparasitaciones: ProximaAplicacion[] | null;
  consultasPorMes: ItemCount[] | null;
  consultasPorVeterinario: ItemCount[] | null;
  frecuenciaConsultasPorPaciente: ItemCount[] | null;
  serviciosMasSolicitados: ItemCount[] | null;
  controlesPreventivosProximos: ProximaAplicacion[] | null;
  demandaPorHorario: HeatmapItem[] | null;
  ingresosPorMetodoPago: ItemMonto[] | null;
  ingresosPorServicio: ItemMonto[] | null;
  cumplimientoVacunacion: ItemCount[] | null;
  cumplimientoDesparasitacion: ItemCount[] | null;
}

export interface ReportesClinicosFiltros {
  companyId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  veterinarioId?: number;
  especie?: string;
}
