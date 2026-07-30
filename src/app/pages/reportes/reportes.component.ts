import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, skip } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';
import { ReportesClinicosService } from '../../core/services/reportes-clinicos.service';
import { EmpleadoService } from '../../core/services/empleado.service';
import { EmpleadoListResponse } from '../../models/response/empleado-list-response';
import {
  ItemCount,
  ReportesClinicos,
  ResumenReporte
} from '../../models/response/reportes-clinicos-response';

Chart.register(...registerables);

type Periodo = 'hoy' | 'semana' | 'mes' | 'personalizado';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss']
})
export default class ReportesComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly reportesService = inject(ReportesClinicosService);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly loadingStore = inject(LoadingStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<ReportesClinicos | null>(null);
  readonly veterinarios = signal<EmpleadoListResponse[]>([]);
  readonly diasSemana = [
    { id: 1, label: 'Lun' }, { id: 2, label: 'Mar' }, { id: 3, label: 'Mié' },
    { id: 4, label: 'Jue' }, { id: 5, label: 'Vie' }, { id: 6, label: 'Sáb' },
    { id: 7, label: 'Dom' }
  ];
  readonly horas = Array.from({ length: 14 }, (_, i) => i + 7);
  readonly especies = [
    ['PERRO', 'Perro'], ['GATO', 'Gato'], ['AVE', 'Ave'], ['REPTIL', 'Reptil'],
    ['ROEDOR', 'Roedor'], ['EXOTICO', 'Exótico'], ['OTRO', 'Otro']
  ];

  periodo: Periodo = 'mes';
  fechaDesde = '';
  fechaHasta = '';
  veterinarioId: number | null = null;
  especie = '';
  private charts: Chart[] = [];

  readonly heatmapMax = computed(() =>
    Math.max(1, ...(this.data()?.demandaPorHorario ?? []).map(item => item.count))
  );

  constructor() {
    toObservable(this.authStore.selectedEnterprise)
      .pipe(
        distinctUntilChanged((a, b) => a?.establishmentId === b?.establishmentId),
        skip(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.cargarVeterinarios();
        this.loadData();
      });
  }

  ngOnInit(): void {
    this.aplicarPeriodo(false);
    this.cargarVeterinarios();
    this.loadData();
  }

  aplicarPeriodo(recargar = true): void {
    const hoy = new Date();
    let desde = new Date(hoy);
    let hasta = new Date(hoy);
    if (this.periodo === 'semana') {
      const day = hoy.getDay() || 7;
      desde.setDate(hoy.getDate() - day + 1);
      hasta = new Date(desde);
      hasta.setDate(desde.getDate() + 6);
    } else if (this.periodo === 'mes') {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    } else if (this.periodo === 'personalizado') {
      return;
    }
    this.fechaDesde = this.toDateInput(desde);
    this.fechaHasta = this.toDateInput(hasta);
    if (recargar) this.loadData();
  }

  aplicarFiltros(): void {
    if (!this.fechaDesde || !this.fechaHasta || this.fechaHasta < this.fechaDesde) return;
    this.loadData();
  }

  limpiarFiltros(): void {
    this.periodo = 'mes';
    this.veterinarioId = null;
    this.especie = '';
    this.aplicarPeriodo();
  }

  variacion(actual: number, anterior: number): number | null {
    if (anterior === 0) return actual === 0 ? 0 : null;
    return ((actual - anterior) / Math.abs(anterior)) * 100;
  }

  variacionTexto(actual: number, anterior: number): string {
    const value = this.variacion(actual, anterior);
    if (value == null) return 'Nuevo en este periodo';
    const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '•';
    return `${arrow} ${Math.abs(value).toFixed(1)}% vs. periodo anterior`;
  }

  heatmapCount(dia: number, hora: number): number {
    return this.data()?.demandaPorHorario?.find(i => i.diaSemana === dia && i.hora === hora)?.count ?? 0;
  }

  heatmapClass(dia: number, hora: number): string {
    const count = this.heatmapCount(dia, hora);
    if (!count) return 'heat-0';
    const ratio = count / this.heatmapMax();
    if (ratio <= .25) return 'heat-1';
    if (ratio <= .5) return 'heat-2';
    if (ratio <= .75) return 'heat-3';
    return 'heat-4';
  }

  formatShortDate(value: string): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short'
    }).replace('.', '');
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency', currency: 'PEN', minimumFractionDigits: 2
    }).format(value ?? 0);
  }

  exportarPdf(): void {
    const reporte = this.data();
    if (!reporte) return;
    const doc = new jsPDF();
    const resumen = reporte.resumen;
    doc.setFontSize(18);
    doc.text('Reportes clínicos', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Periodo: ${reporte.fechaDesde} al ${reporte.fechaHasta}`, 14, 26);
    doc.setTextColor(20);
    const lineas = [
      `Consultas: ${resumen.consultas}`,
      `Pacientes atendidos: ${resumen.pacientesAtendidos}`,
      `Ingresos: ${this.formatMoney(resumen.ingresos)}`,
      `Nuevos pacientes: ${resumen.nuevosPacientes}`,
      `Tiempo promedio de atención: ${resumen.tiempoPromedioAtencionMinutos} min`,
      `Citas completadas: ${resumen.porcentajeCitasCompletadas}%`
    ];
    lineas.forEach((linea, index) => doc.text(linea, 14, 40 + index * 8));
    this.addPdfSection(doc, 'Estado de citas', reporte.consultasPorEstado, 94);
    this.addPdfSection(doc, 'Servicios más solicitados', reporte.serviciosMasSolicitados, 140);
    doc.save(`reporte-clinico-${reporte.fechaDesde}-${reporte.fechaHasta}.pdf`);
  }

  exportarExcel(): void {
    const reporte = this.data();
    if (!reporte) return;
    const rows = [
      ['REPORTE CLÍNICO', ''],
      ['Periodo', `${reporte.fechaDesde} al ${reporte.fechaHasta}`],
      ['Consultas', reporte.resumen.consultas],
      ['Pacientes atendidos', reporte.resumen.pacientesAtendidos],
      ['Ingresos', reporte.resumen.ingresos],
      ['Nuevos pacientes', reporte.resumen.nuevosPacientes],
      ['Tiempo promedio (min)', reporte.resumen.tiempoPromedioAtencionMinutos],
      ['Citas completadas (%)', reporte.resumen.porcentajeCitasCompletadas],
      [],
      ['ESTADO DE CITAS', 'CANTIDAD'],
      ...reporte.consultasPorEstado.map(i => [i.label, i.count]),
      [],
      ['SERVICIOS MÁS SOLICITADOS', 'CANTIDAD'],
      ...reporte.serviciosMasSolicitados.map(i => [i.label, i.count])
    ];
    const html = `<table>${rows.map(row =>
      `<tr>${row.map(cell => `<td>${this.escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`
    ).join('')}</table>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-clinico-${reporte.fechaDesde}-${reporte.fechaHasta}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private loadData(): void {
    if (!this.fechaDesde || !this.fechaHasta) return;
    this.loadingStore.show();
    this.reportesService.obtenerReportes({
      companyId: this.companyId(),
      fechaDesde: this.fechaDesde,
      fechaHasta: this.fechaHasta,
      veterinarioId: this.veterinarioId ?? undefined,
      especie: this.especie || undefined
    }).subscribe({
      next: response => {
        this.data.set(response.data);
        this.loadingStore.hide();
        setTimeout(() => this.renderCharts());
      },
      error: () => this.loadingStore.hide()
    });
  }

  private cargarVeterinarios(): void {
    this.empleadoService.listar(this.companyId(), undefined, 0, 200).subscribe({
      next: response => this.veterinarios.set(
        (response.data.content ?? []).filter(e =>
          e.activo && e.tiposEmpleado?.some(tipo => tipo.toUpperCase().includes('VETERIN'))
        )
      )
    });
  }

  private renderCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
    const reporte = this.data();
    if (!reporte) return;
    const font = { family: "'Barlow', sans-serif", size: 11 };
    const grid = '#eef2f7';

    this.createLine('chartEvolucion', reporte.consultasPorMes, '#169b62', font, grid);
    this.createHorizontalBar('chartEstados', reporte.consultasPorEstado, font, grid,
      ['#22a06b', '#f59e0b', '#4f86e8', '#ef5b5b', '#8b5cf6', '#64748b']);
    this.createDoughnut('chartEspecies', reporte.pacientesPorEspecie,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d', '#64748b'], font);
    this.createHorizontalBar('chartServicios', reporte.serviciosMasSolicitados, font, grid,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#ef667d']);
    this.createBar('chartEdades', reporte.pacientesPorRangoEdad, font, grid,
      ['#397ce8', '#27ad6f', '#f5a524', '#8b5cf6', '#64748b']);
  }

  private createLine(id: string, items: ItemCount[], color: string, font: any, grid: string): void {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas || !items.length) return;
    this.charts.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels: items.map(i => i.label),
        datasets: [{ data: items.map(i => i.count), borderColor: color, backgroundColor: '#eaf8f1',
          fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: '#fff', pointBorderWidth: 2 }]
      },
      options: this.chartOptions(font, grid)
    }));
  }

  private createBar(id: string, items: ItemCount[], font: any, grid: string, colors: string[]): void {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas || !items.length) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: { labels: items.map(i => i.label), datasets: [{
        data: items.map(i => i.count), backgroundColor: items.map((_, i) => colors[i % colors.length]),
        borderRadius: 5, maxBarThickness: 34
      }] },
      options: this.chartOptions(font, grid)
    }));
  }

  private createHorizontalBar(id: string, items: ItemCount[], font: any, grid: string, colors: string[]): void {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas || !items.length) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: { labels: items.map(i => i.label), datasets: [{
        data: items.map(i => i.count), backgroundColor: items.map((_, i) => colors[i % colors.length]),
        borderRadius: 4, maxBarThickness: 22
      }] },
      options: { ...this.chartOptions(font, grid), indexAxis: 'y' }
    }));
  }

  private createDoughnut(id: string, items: ItemCount[], colors: string[], font: any): void {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas || !items.length) return;
    this.charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: { labels: items.map(i => i.label), datasets: [{
        data: items.map(i => i.count), backgroundColor: colors, borderWidth: 3, borderColor: '#fff'
      }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '66%',
        plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', font } } }
      }
    }));
  }

  private chartOptions(font: any, grid: string): any {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font, color: '#60708a' } },
        y: { beginAtZero: true, grid: { color: grid }, ticks: { font, color: '#60708a', precision: 0 } }
      }
    };
  }

  private addPdfSection(doc: jsPDF, title: string, items: ItemCount[], startY: number): void {
    doc.setFontSize(12);
    doc.text(title, 14, startY);
    doc.setFontSize(9);
    items.slice(0, 8).forEach((item, index) =>
      doc.text(`${item.label}: ${item.count}`, 18, startY + 8 + index * 6)
    );
  }

  private companyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId() ?? undefined;
  }

  private toDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!)
    );
  }
}
