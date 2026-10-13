import { Injectable, OnDestroy } from '@angular/core';
import type { Chart, ChartOptions, FontSpec } from 'chart.js';
import { ItemCount, ItemMonto, ReportesClinicos } from '../../models/response/reportes-clinicos-response';

type ChartConstructor = typeof import('chart.js')['Chart'];

export type ReportChartName = 'evolucion' | 'estados' | 'especies' | 'edades' | 'veterinarios' | 'frecuencia'
  | 'ingresosMetodo' | 'ingresosServicio';

const FONT: Partial<FontSpec> = {
  family: "'Barlow', sans-serif",
  size: 11
};
const GRID_COLOR = '#eef2f7';


const CATEGORICAL_PALETTE = ['#1baf7a', '#eda100', '#4a3aa7', '#e34948', '#008300', '#2a78d6', '#eb6834'];


const ESTADO_CONSULTA_COLORS: Record<string, string> = {
  'Completada': '#0ca30c',
  'En proceso': '#fab219',
  'Programada': '#4a3aa7',
  'Confirmada': '#4a3aa7',
  'Sala de espera': '#1baf7a',
  'Pendiente': '#fab219',
  'Reprogramada': '#2a78d6',
  'Cancelada': '#d03b3b',
  'No asistió': '#d03b3b',
  'Eliminada': '#898781',
  'Otro': '#898781'
};


export const CUMPLIMIENTO_COLORS: Record<string, string> = {
  'Al día': '#0ca30c',
  'Atrasado': '#d03b3b'
};


function colorsForLabels(
  labels: string[],
  byLabel: Record<string, string>,
  fallback: string[] = CATEGORICAL_PALETTE,
  offset = 0
): string[] {
  return labels.map((label, index) => byLabel[label] ?? fallback[(index + offset) % fallback.length]);
}


function capToTopWithOthers(items: ItemCount[], max: number): ItemCount[] {
  if (items.length <= max) return items;
  const top = items.slice(0, max - 1);
  const resto = items.slice(max - 1).reduce((acc, item) => acc + item.count, 0);
  return [...top, { label: 'Otros', count: resto }];
}

function capToTopWithOthersMonto(items: ItemMonto[], max: number): ItemMonto[] {
  if (items.length <= max) return items;
  const top = items.slice(0, max - 1);
  const resto = items.slice(max - 1).reduce((acc, item) => acc + item.monto, 0);
  return [...top, { label: 'Otros', monto: resto }];
}

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
  private chartConstructor: ChartConstructor | null = null;
  private chartRuntimePromise: Promise<ChartConstructor> | null = null;
  private renderRequestId = 0;

  async render(reporte: ReportesClinicos, canvases: readonly HTMLCanvasElement[]): Promise<void> {
    const requestId = ++this.renderRequestId;
    this.destroyCharts();
    this.chartConstructor = await this.loadChartRuntime();
    if (requestId !== this.renderRequestId) return;

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
    this.createHorizontalBar(canvasByName.get('veterinarios'), reporte.consultasPorVeterinario, {}, 4);
    this.createDoughnut(canvasByName.get('edades'), reporte.pacientesPorRangoEdad, {}, 2);
    this.createBar(
      canvasByName.get('frecuencia'),
      reporte.frecuenciaConsultasPorPaciente,
      {},
      6
    );
    this.createHorizontalBarMonto(
      canvasByName.get('ingresosMetodo'),
      reporte.ingresosPorMetodoPago,
      {},
      1
    );
    this.createDoughnutMonto(canvasByName.get('ingresosServicio'), reporte.ingresosPorServicio, 3);
  }

  destroy(): void {
    this.renderRequestId++;
    this.destroyCharts();
  }

  private destroyCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private loadChartRuntime(): Promise<ChartConstructor> {
    if (!this.chartRuntimePromise) {
      this.chartRuntimePromise = import('chart.js').then(({ Chart: ChartRuntime, registerables }) => {
        ChartRuntime.register(...registerables);
        return ChartRuntime;
      });
    }
    return this.chartRuntimePromise;
  }

  private createLine(canvas: HTMLCanvasElement | undefined, items: ItemCount[] | null): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new this.chartConstructor!(canvas, {
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
    colorsByLabel: Record<string, string> = {},
    offset = 0
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new this.chartConstructor!(canvas, {
      type: 'bar',
      data: this.barData(items, colorsByLabel, 34, offset),
      options: barOptions('x')
    }));
  }

  private createHorizontalBar(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[] | null,
    colorsByLabel: Record<string, string> = {},
    offset = 0
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new this.chartConstructor!(canvas, {
      type: 'bar',
      data: this.barData(items, colorsByLabel, 22, offset),
      options: barOptions('y')
    }));
  }

  private createDoughnut(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[] | null,
    colorsByLabel: Record<string, string> = {},
    offset = 0
  ): void {
    if (!canvas || !items || items.length === 0) return;
    const capped = capToTopWithOthers(items, 6);
    this.charts.push(new this.chartConstructor!(canvas, {
      type: 'doughnut',
      data: {
        labels: capped.map(item => item.label),
        datasets: [{
          data: capped.map(item => item.count),
          backgroundColor: capped.map((item, index) =>
            item.label === 'Otros' ? '#cbd5e1' : (colorsByLabel[item.label] ?? CATEGORICAL_PALETTE[(index + offset) % CATEGORICAL_PALETTE.length])
          ),
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

  private createDoughnutMonto(
    canvas: HTMLCanvasElement | undefined,
    items: ItemMonto[] | null,
    offset = 0
  ): void {
    if (!canvas || !items || items.length === 0) return;
    const capped = capToTopWithOthersMonto(items, 6);
    this.charts.push(new this.chartConstructor!(canvas, {
      type: 'doughnut',
      data: {
        labels: capped.map(item => item.label),
        datasets: [{
          data: capped.map(item => item.monto),
          backgroundColor: capped.map((item, index) =>
            item.label === 'Otros' ? '#cbd5e1' : CATEGORICAL_PALETTE[(index + offset) % CATEGORICAL_PALETTE.length]
          ),
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
          },
          tooltip: {
            callbacks: {
              label: context => {
                const value = typeof context.raw === 'number' ? context.raw : 0;
                return ` ${context.label}: ${new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value)}`;
              }
            }
          }
        }
      }
    }));
  }

  private barData(items: ItemCount[], colorsByLabel: Record<string, string>, maxBarThickness: number, offset = 0) {
    return {
      labels: items.map(item => item.label),
      datasets: [{
        data: items.map(item => item.count),
        backgroundColor: colorsForLabels(items.map(item => item.label), colorsByLabel, CATEGORICAL_PALETTE, offset),
        borderRadius: 5,
        maxBarThickness
      }]
    };
  }

  private createHorizontalBarMonto(
    canvas: HTMLCanvasElement | undefined,
    items: ItemMonto[] | null,
    colorsByLabel: Record<string, string> = {},
    offset = 0
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new this.chartConstructor!(canvas, {
      type: 'bar',
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          data: items.map(item => item.monto),
          backgroundColor: colorsForLabels(items.map(item => item.label), colorsByLabel, CATEGORICAL_PALETTE, offset),
          borderRadius: 5,
          maxBarThickness: 22
        }]
      },
      options: barOptions('y')
    }));
  }

}
