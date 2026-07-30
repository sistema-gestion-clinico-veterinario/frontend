import { Injectable, OnDestroy } from '@angular/core';
import { Chart, ChartOptions, FontSpec, registerables } from 'chart.js';
import { ItemCount, ReportesClinicos } from '../../models/response/reportes-clinicos-response';

Chart.register(...registerables);

export type ReportChartName = 'evolucion' | 'estados' | 'especies' | 'servicios' | 'edades';

const FONT: Partial<FontSpec> = {
  family: "'Barlow', sans-serif",
  size: 11
};
const GRID_COLOR = '#eef2f7';
const LINE_OPTIONS: ChartOptions<'line'> = {
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
const BAR_OPTIONS: ChartOptions<'bar'> = {
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
      ['#22a06b', '#f59e0b', '#4f86e8', '#ef5b5b', '#8b5cf6', '#64748b']
    );
    this.createDoughnut(canvasByName.get('especies'), reporte.pacientesPorEspecie);
    this.createHorizontalBar(
      canvasByName.get('servicios'),
      reporte.serviciosMasSolicitados,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d']
    );
    this.createBar(
      canvasByName.get('edades'),
      reporte.pacientesPorRangoEdad,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#64748b']
    );
  }

  destroy(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private createLine(canvas: HTMLCanvasElement | undefined, items: ItemCount[]): void {
    if (!canvas || items.length === 0) return;
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
      options: LINE_OPTIONS
    }));
  }

  private createBar(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[],
    colors: string[]
  ): void {
    if (!canvas || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: this.barData(items, colors, 34),
      options: BAR_OPTIONS
    }));
  }

  private createHorizontalBar(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[],
    colors: string[]
  ): void {
    if (!canvas || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: this.barData(items, colors, 22),
      options: {
        ...BAR_OPTIONS,
        indexAxis: 'y'
      }
    }));
  }

  private createDoughnut(canvas: HTMLCanvasElement | undefined, items: ItemCount[]): void {
    if (!canvas || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          data: items.map(item => item.count),
          backgroundColor: ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d', '#64748b'],
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

  private barData(items: ItemCount[], colors: string[], maxBarThickness: number) {
    return {
      labels: items.map(item => item.label),
      datasets: [{
        data: items.map(item => item.count),
        backgroundColor: items.map((_, index) => colors[index % colors.length]),
        borderRadius: 5,
        maxBarThickness
      }]
    };
  }

}
