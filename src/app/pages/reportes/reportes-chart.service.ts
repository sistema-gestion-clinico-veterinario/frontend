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
    this.createHorizontalBar(
      canvasByName.get('veterinarios'),
      reporte.consultasPorVeterinario,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d', '#64748b']
    );
    this.createBar(
      canvasByName.get('frecuencia'),
      reporte.frecuenciaConsultasPorPaciente,
      ['#397ce8', '#27ad6f', '#f5a524']
    );
    this.createHorizontalBarMonto(
      canvasByName.get('ingresosMetodo'),
      reporte.ingresosPorMetodoPago,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d', '#64748b']
    );
    this.createHorizontalBarMonto(
      canvasByName.get('ingresosServicio'),
      reporte.ingresosPorServicio,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d', '#64748b']
    );
    this.createDoughnut(
      canvasByName.get('cumplimientoVacunacion'),
      reporte.cumplimientoVacunacion,
      ['#27ad6f', '#ef5b5b']
    );
    this.createDoughnut(
      canvasByName.get('cumplimientoDesparasitacion'),
      reporte.cumplimientoDesparasitacion,
      ['#27ad6f', '#ef5b5b']
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
    colors: string[]
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: this.barData(items, colors, 34),
      options: barOptions('x')
    }));
  }

  private createHorizontalBar(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[] | null,
    colors: string[]
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: this.barData(items, colors, 22),
      options: barOptions('y')
    }));
  }

  private createDoughnut(
    canvas: HTMLCanvasElement | undefined,
    items: ItemCount[] | null,
    colors: string[] = ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d', '#64748b']
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          data: items.map(item => item.count),
          backgroundColor: colors,
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

  private createHorizontalBarMonto(
    canvas: HTMLCanvasElement | undefined,
    items: ItemMonto[] | null,
    colors: string[]
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: items.map(item => item.label),
        datasets: [{
          data: items.map(item => item.monto),
          backgroundColor: items.map((_, index) => colors[index % colors.length]),
          borderRadius: 5,
          maxBarThickness: 22
        }]
      },
      options: barOptions('y')
    }));
  }

}
