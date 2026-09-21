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
  noAsistieron: number;
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

export interface PacienteInactivo {
  mascota: string;
  apoderado: string;
  ultimaVisita: string;
  diasSinVisitar: number;
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
  pacientesFrecuentes: ItemCount[] | null;
  vacunasMasAplicadas: ItemCount[] | null;
  desparasitantesMasAplicados: ItemCount[] | null;
  pacientesInactivos: PacienteInactivo[] | null;
}

export interface ReportesClinicosFiltros {
  companyId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  veterinarioId?: number;
  especie?: string;
}

export interface EmpresaResumen {
  companyId: number;
  companyName: string;
  consultas: number;
  pacientesAtendidos: number;
  /** null cuando el usuario no tiene permiso VISTA_PAGOS: el dato financiero no se expone. */
  ingresos: number | null;
  nuevosPacientes: number;
  porcentajeCitasCompletadas: number;
  noAsistieron: number;
}

/** Solo para administración de plataforma: un resumen por empresa, sin mezclar sus cifras. */
export interface ReportesComparativoEmpresas {
  fechaDesde: string;
  fechaHasta: string;
  empresas: EmpresaResumen[];
}

/** Página de "Pacientes sin visitar hace 3+ meses", calculada y paginada desde el backend. */
export interface PacientesInactivosPage {
  content: PacienteInactivo[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
