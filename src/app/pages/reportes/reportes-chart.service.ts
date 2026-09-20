import { Injectable, OnDestroy } from '@angular/core';
import { Chart, ChartOptions, FontSpec, registerables } from 'chart.js';
import { ItemCount, ItemMonto, ReportesClinicos } from '../../models/response/reportes-clinicos-response';

Chart.register(...registerables);

export type ReportChartName = 'evolucion' | 'estados' | 'especies' | 'servicios' | 'edades' | 'veterinarios' | 'frecuencia'
  | 'ingresosMetodo' | 'ingresosServicio' | 'cumplimientoVacunacion' | 'cumplimientoDesparasitacion';

const FONT: Partial<FontSpec> = {
  family: "'Barlow', sans-serif",
  size: 11
};
const GRID_COLOR = '#eef2f7';

// Paleta única para datos puramente categóricos (sin significado propio: servicios,
// veterinarios, rangos de edad, métodos de pago...) — mismo orden y tono en todos los
// gráficos para que la misma posición siempre se vea igual entre tarjetas.
const CATEGORICAL_PALETTE = ['#397ce8', '#27ad6f', '#f59e0b', '#8b5cf6', '#ef5b5b', '#64748b', '#06b6d4', '#f97316'];

// Colores por NOMBRE de etiqueta, no por posición en el array: el backend ordena estos
// grupos por frecuencia (el más numeroso primero), así que un color fijo por índice
// terminaría pintando "Cancelada" de verde un período y de rojo el siguiente. Asignar
// el color al texto de la etiqueta evita ese problema y le da significado real al color.
const ESTADO_CONSULTA_COLORS: Record<string, string> = {
  'Completada': '#22a06b',
  'En proceso': '#f59e0b',
  'Programada': '#4f86e8',
  'Confirmada': '#4f86e8',
  'Sala de espera': '#06b6d4',
  'Pendiente': '#f59e0b',
  'Reprogramada': '#8b5cf6',
  'Cancelada': '#ef5b5b',
  'No asistio': '#ef5b5b',
  'Eliminada': '#64748b',
  'Otro': '#64748b'
};

const CUMPLIMIENTO_COLORS: Record<string, string> = {
  'Al día': '#22a06b',
  'Atrasado': '#ef5b5b'
};

function colorsForLabels(labels: string[], byLabel: Record<string, string>, fallback: string[] = CATEGORICAL_PALETTE): string[] {
  return labels.map((label, index) => byLabel[label] ?? fallback[index % fallback.length]);
}

/**
 * Chart.js muta/normaliza los objetos de `scales` que recibe (les adjunta estado interno de
 * escala). Si varias instancias de Chart comparten el mismo objeto anidado (p. ej. vía
 * `{...OPTIONS, indexAxis:'y'}`, que es un spread superficial), esa mutación se filtra entre
 * gráficos según el orden de creación y corrompe el layout de unos con el de otros — por eso
 * cada gráfico debe construirse con su propio objeto de opciones, nunca uno reutilizado.
 */
function lineOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: FONT, color: '#60708a' }
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID_COLOR },
        ticks: { font: FONT, color: '#60708a', precision: 0 }
      }
    }
  };
}

function barOptions(indexAxis: 'x' | 'y'): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: FONT, color: '#60708a' }
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID_COLOR },
        ticks: { font: FONT, color: '#60708a', precision: 0 }
      }
    }
  };
}

@Injectable()
export class ReportesChartService implements OnDestroy {
  private charts: Chart[] = [];

  render(reporte: ReportesClinicos, canvases: readonly HTMLCanvasElement[]): void {
    this.destroy();
    const canvasByName = new Map<ReportChartName, HTMLCanvasElement>();

    canvases.forEach(canvas => {
      const name = canvas.dataset['reportChart'] as ReportChartName | undefined;
      if (name) canvasByName.set(name, canvas);
    });

    this.createLine(canvasByName.get('evolucion'), reporte.consultasPorMes);
    this.createHorizontalBar(
      canvasByName.get('estados'),
      reporte.consultasPorEstado,
      ESTADO_CONSULTA_COLORS
    );
    this.createDoughnut(canvasByName.get('especies'), reporte.pacientesPorEspecie);
    this.createHorizontalBar(
      canvasByName.get('servicios'),
      reporte.serviciosMasSolicitados
    );
    this.createBar(
      canvasByName.get('edades'),
      reporte.pacientesPorRangoEdad
    );
    this.createHorizontalBar(
      canvasByName.get('veterinarios'),
      reporte.consultasPorVeterinario
    );
    this.createBar(
      canvasByName.get('frecuencia'),
      reporte.frecuenciaConsultasPorPaciente
    );
    this.createHorizontalBarMonto(
      canvasByName.get('ingresosMetodo'),
      reporte.ingresosPorMetodoPago
    );
    this.createHorizontalBarMonto(
      canvasByName.get('ingresosServicio'),
      reporte.ingresosPorServicio
    );
    this.createDoughnut(
      canvasByName.get('cumplimientoVacunacion'),
      reporte.cumplimientoVacunacion,
      CUMPLIMIENTO_COLORS
    );
    this.createDoughnut(
      canvasByName.get('cumplimientoDesparasitacion'),
      reporte.cumplimientoDesparasitacion,
      CUMPLIMIENTO_COLORS
    );
  }

  destroy(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private createLine(canvas: HTMLCanvasElement | undefined, items: ItemCount[] | null): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          data: items.map(item => item.count),
          borderColor: '#169b62',
          backgroundColor: '#eaf8f1',
          fill: true,
          tension: .35,
          pointRadius: 3,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: lineOptions()
    }));
  }

  private createBar(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[] | null,
    colorsByLabel: Record<string, string> = {}
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: this.barData(items, colorsByLabel, 34),
      options: barOptions('x')
    }));
  }

  private createHorizontalBar(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[] | null,
    colorsByLabel: Record<string, string> = {}
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: this.barData(items, colorsByLabel, 22),
      options: barOptions('y')
    }));
  }

  private createDoughnut(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[] | null,
    colorsByLabel: Record<string, string> = {}
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          data: items.map(item => item.count),
          backgroundColor: colorsForLabels(items.map(item => item.label), colorsByLabel),
          borderWidth: 3,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: {
            position: canvas.clientWidth < 480 ? 'bottom' : 'right',
            labels: { usePointStyle: true, pointStyle: 'circle', font: FONT }
          }
        }
      }
    }));
  }

  private barData(items: ItemCount[], colorsByLabel: Record<string, string>, maxBarThickness: number) {
    return {
      labels: items.map(item => item.label),
      datasets: [{
        data: items.map(item => item.count),
        backgroundColor: colorsForLabels(items.map(item => item.label), colorsByLabel),
        borderRadius: 5,
        maxBarThickness
      }]
    };
  }

  private createHorizontalBarMonto(
    canvas: HTMLCanvasElement | undefined,
    items: ItemMonto[] | null,
    colorsByLabel: Record<string, string> = {}
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          data: items.map(item => item.monto),
          backgroundColor: colorsForLabels(items.map(item => item.label), colorsByLabel),
          borderRadius: 5,
          maxBarThickness: 22
        }]
      },
      options: barOptions('y')
    }));
  }

}
