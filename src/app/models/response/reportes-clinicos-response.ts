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
  ingresos: number | null;
  nuevosPacientes: number;
  porcentajeCitasCompletadas: number;
  noAsistieron: number;
}

export interface ReportesComparativoEmpresas {
  fechaDesde: string;
  fechaHasta: string;
  empresas: EmpresaResumen[];
}


export interface PacientesInactivosPage {
  content: PacienteInactivo[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ReporteVentasProductos {
  fechaDesde: string;
  fechaHasta: string;
  resumen: {
    ventas: number | null;
    ingresos: number | null;
    unidadesVendidas: number | null;
    ticketPromedio: number | null;
    productosStockBajo: number | null;
    productosSinStock: number | null;
  };
  resumenAnterior: {
    ventas: number | null;
    ingresos: number | null;
    unidadesVendidas: number | null;
    ticketPromedio: number | null;
    productosStockBajo: null;
    productosSinStock: null;
  };
  ventasPorMetodo: { nombre: string; cantidad: number; monto: number }[] | null;
  ventasPorDia: { nombre: string; cantidad: number; monto: number }[] | null;
  productosMasVendidos: { sku: string; nombre: string; cantidad: number; monto: number }[] | null;
  alertasStock: { sku: string; nombre: string; categoria: string; stock: number; stockMinimo: number }[] | null;
}

export interface ReporteVentasProductosFiltros {
  companyId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  metodoPago?: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA';
  categoriaId?: number;
  productoId?: number;
  marcaId?: number;
  estadoStock?: 'NORMAL' | 'BAJO' | 'SIN_STOCK';
}
