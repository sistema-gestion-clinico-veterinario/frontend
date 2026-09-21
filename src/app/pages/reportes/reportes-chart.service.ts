import { Injectable, OnDestroy } from '@angular/core';
import { Chart, ChartOptions, FontSpec, registerables } from 'chart.js';
import { ItemCount, ItemMonto, ReportesClinicos } from '../../models/response/reportes-clinicos-response';

Chart.register(...registerables);

export type ReportChartName = 'evolucion' | 'estados' | 'especies' | 'edades' | 'veterinarios' | 'frecuencia'
  | 'ingresosMetodo' | 'ingresosServicio';

const FONT: Partial<FontSpec> = {
  family: "'Barlow', sans-serif",
  size: 11
};
const GRID_COLOR = '#eef2f7';

// Paleta para datos categóricos donde la categoría SÍ tiene identidad propia (especies,
// por ejemplo) — sin rosado/magenta a pedido del usuario. Orden validado contra
// separación por daltonismo y contraste (ver skill de dataviz); empieza en verde
// azulado en vez de azul para no repetir el acento de la marca.
const CATEGORICAL_PALETTE = ['#1baf7a', '#eda100', '#4a3aa7', '#e34948', '#008300', '#2a78d6', '#eb6834'];

// Colores por NOMBRE de etiqueta, no por posición en el array: el backend ordena estos
// grupos por frecuencia (el más numeroso primero), así que un color fijo por índice
// terminaría pintando "Cancelada" de verde un período y de rojo el siguiente. Asignar
// el color al texto de la etiqueta evita ese problema y le da significado real al color.
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

/** Reutilizado también por el medidor HTML de cumplimiento (ver reportes.component.html). */
export const CUMPLIMIENTO_COLORS: Record<string, string> = {
  'Al día': '#0ca30c',
  'Atrasado': '#d03b3b'
};

// `offset` rota el punto de partida en la paleta: así dos gráficos de "top N" en la misma
// pantalla no arrancan ambos en el mismo color y se distinguen entre sí a simple vista,
// aunque los dos usen la misma paleta multicolor.
function colorsForLabels(
  labels: string[],
  byLabel: Record<string, string>,
  fallback: string[] = CATEGORICAL_PALETTE,
  offset = 0
): string[] {
  return labels.map((label, index) => byLabel[label] ?? fallback[(index + offset) % fallback.length]);
}

// Las formas radiales (dona, anillo polar) se rompen visualmente con muchas categorías: las
// porciones chicas se vuelven invisibles junto al centro y la leyenda se llena de nombres. Por
// eso, antes de graficar, se agrupan las categorías que sobran más allá de `max` en "Otros" —
// nunca se generan más colores ni se intenta mostrar todo. El backend ya entrega estas listas
// ordenadas de mayor a menor, así que tomar las primeras `max - 1` conserva lo más relevante.
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
    // "Consultas por empleado" vuelve a barra horizontal: el número de empleados no tiene techo
    // (una clínica grande puede tener decenas), y a diferencia de una forma radial (dona, anillo
    // polar), una barra no se rompe con muchas filas — el panel simplemente crece o hace scroll,
    // sin porciones invisibles ni leyenda ilegible. "Pacientes por edad" se queda en dona porque
    // sus categorías están acotadas por diseño (los rangos de edad son un catálogo fijo y corto).
    // "Cumplimiento" ya no es <canvas>: se muestra como medidor de progreso (ver plantilla).
    // "Servicios más solicitados", "Pacientes frecuentes", "Vacunas más aplicadas" y
    // "Desparasitantes más aplicados" tampoco son <canvas>: dos se renderizan como lista
    // numerada y dos como tarjeta de destacado (ver reportes.component.html).
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
    // Dona en vez de otra barra de dinero más: el ingreso por servicio es literalmente un reparto
    // del ingreso total (cada porción = % de lo facturado), distinto de "Ingresos por método"
    // (que sigue en barra, más apropiado para comparar montos exactos entre pocas formas de pago).
    this.createDoughnutMonto(canvasByName.get('ingresosServicio'), reporte.ingresosPorServicio, 3);
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
    colorsByLabel: Record<string, string> = {},
    offset = 0
  ): void {
    if (!canvas || !items || items.length === 0) return;
    this.charts.push(new Chart(canvas, {
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
    this.charts.push(new Chart(canvas, {
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
    this.charts.push(new Chart(canvas, {
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
    this.charts.push(new Chart(canvas, {
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
    this.charts.push(new Chart(canvas, {
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
