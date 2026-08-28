import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChildren
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, combineLatest } from 'rxjs';
import { catchError, distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';
import { EmpleadoService } from '../../core/services/empleado.service';
import { ReportesClinicosService } from '../../core/services/reportes-clinicos.service';
import { EmpleadoListResponse } from '../../models/response/empleado-list-response';
import {
  ReportesClinicos,
  ReportesClinicosFiltros
} from '../../models/response/reportes-clinicos-response';
import { AuthStore } from '../../store/auth.store';
import { ReportesChartService } from './reportes-chart.service';
import { ReportesExportService } from './reportes-export.service';
import { Periodo, calcularRangoPeriodo } from './reportes-periodo.utils';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [ReportesChartService, ReportesExportService],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export default class ReportesComponent {
  private readonly authStore = inject(AuthStore);
  private readonly reportesService = inject(ReportesClinicosService);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly chartService = inject(ReportesChartService);
  private readonly exportService = inject(ReportesExportService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloadReports = new Subject<void>();
  private readonly chartCanvases =
    viewChildren<ElementRef<HTMLCanvasElement>>('reportChart');
  private readonly selectedCompanyId = computed(() =>
    this.authStore.selectedEnterprise()?.establishmentId
      ?? this.authStore.companyId()
      ?? undefined
  );

  readonly data = signal<ReportesClinicos | null>(null);
  readonly veterinarios = signal<EmpleadoListResponse[]>([]);
  readonly diasSemana = [
    { id: 1, label: 'Lun' },
    { id: 2, label: 'Mar' },
    { id: 3, label: 'Mié' },
    { id: 4, label: 'Jue' },
    { id: 5, label: 'Vie' },
    { id: 6, label: 'Sáb' },
    { id: 7, label: 'Dom' }
  ];
  readonly horas = Array.from({ length: 14 }, (_, index) => index + 7);
  readonly especies = [
    ['PERRO', 'Perro'],
    ['GATO', 'Gato'],
    ['AVE', 'Ave'],
    ['REPTIL', 'Reptil'],
    ['ROEDOR', 'Roedor'],
    ['EXOTICO', 'Exótico'],
    ['OTRO', 'Otro']
  ] as const;

  periodo: Periodo = 'todos';
  fechaDesde = '';
  fechaHasta = '';
  veterinarioId: number | null = null;
  especie = '';

  readonly heatmapMax = computed(() =>
    Math.max(1, ...(this.data()?.demandaPorHorario ?? []).map(item => item.count))
  );
  private readonly heatmapIndex = computed(() =>
    new Map(
      (this.data()?.demandaPorHorario ?? [])
        .map(item => [`${item.diaSemana}-${item.hora}`, item.count] as const)
    )
  );

  constructor() {
    this.actualizarRangoSeleccionado();

    const companyId$ = toObservable(this.selectedCompanyId).pipe(
      distinctUntilChanged()
    );

    companyId$
      .pipe(
        switchMap(companyId =>
          this.empleadoService.listar(companyId, undefined, 0, 200).pipe(
            catchError(() => EMPTY)
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        const empleados = response.data.content ?? [];
        this.veterinarios.set(
          empleados.filter(empleado =>
            empleado.activo
            && empleado.tiposEmpleado?.some(tipo =>
              tipo.toUpperCase().includes('VETERIN')
            )
          )
        );
      });

    combineLatest([
      companyId$,
      this.reloadReports.pipe(startWith(undefined))
    ])
      .pipe(
        switchMap(([companyId]) =>
          this.reportesService.obtenerReportes(this.buildFilters(companyId)).pipe(
            catchError(() => EMPTY)
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => this.data.set(response.data));

    afterRenderEffect(() => {
      const reporte = this.data();
      const canvases = this.chartCanvases().map(reference => reference.nativeElement);

      if (reporte) {
        this.chartService.render(reporte, canvases);
      } else {
        this.chartService.destroy();
      }
    });
  }

  onFiltrosChange(): void {
    if (this.periodo === 'personalizado') return;
    this.actualizarRangoSeleccionado();
    this.reloadReports.next();
  }

  aplicarFiltros(): void {
    if (!this.rangoValido()) return;
    this.reloadReports.next();
  }

  limpiarFiltros(): void {
    this.periodo = 'todos';
    this.veterinarioId = null;
    this.especie = '';
    this.actualizarRangoSeleccionado();
    this.reloadReports.next();
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
    return this.heatmapIndex().get(`${dia}-${hora}`) ?? 0;
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
    return new Date(year, month - 1, day)
      .toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
      .replace('.', '');
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(value ?? 0);
  }

  async exportarPdf(): Promise<void> {
    const reporte = this.data();
    if (reporte) await this.exportService.exportarPdf(reporte);
  }

  exportarExcel(): void {
    const reporte = this.data();
    if (reporte) this.exportService.exportarExcel(reporte);
  }

  private actualizarRangoSeleccionado(): void {
    const rango = calcularRangoPeriodo(this.periodo);
    this.fechaDesde = rango.fechaDesde;
    this.fechaHasta = rango.fechaHasta;
  }

  private rangoValido(): boolean {
    return Boolean(
      this.fechaDesde
      && this.fechaHasta
      && this.fechaDesde <= this.fechaHasta
    );
  }

  private buildFilters(companyId: number | undefined): ReportesClinicosFiltros {
    return {
      companyId,
      fechaDesde: this.fechaDesde,
      fechaHasta: this.fechaHasta,
      veterinarioId: this.veterinarioId ?? undefined,
      especie: this.especie || undefined
    };
  }
}
