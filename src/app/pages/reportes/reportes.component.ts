import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChildren
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';
import { EmpleadoService } from '../../core/services/empleado.service';
import { CompanyService } from '../../core/services/company.service';
import { CompanyDTO } from '../../models/request/company-dto';
import { ReportesClinicosService } from '../../core/services/reportes-clinicos.service';
import { EmpleadoListResponse } from '../../models/response/empleado-list-response';
import {
  ReportesClinicos,
  ReportesClinicosFiltros,
  ReportesComparativoEmpresas,
  PacientesInactivosPage,
  ReporteVentasProductos
} from '../../models/response/reportes-clinicos-response';
import { AuthStore } from '../../store/auth.store';
import { ReportesChartService } from './reportes-chart.service';
import type { ReportesExportService, ReportChartImage } from './reportes-export.service';
import { Periodo, calcularRangoPeriodo } from './reportes-periodo.utils';
import { ReportesTopListComponent } from './top-list/top-list.component';
import { ReportesMeterComponent } from './meter/meter.component';
import { ReportesEmphasisComponent } from './emphasis/emphasis.component';
import { ProductoService } from '../../core/services/producto.service';
import { CategoriaProductoService } from '../../core/services/categoria-producto.service';
import { MarcaProductoService } from '../../core/services/marca-producto.service';
import { ProductoResponse } from '../../models/response/producto-response';
import { CategoriaProductoResponse } from '../../models/response/categoria-producto-response';
import { MarcaProductoResponse } from '../../models/response/marca-producto-response';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReportesTopListComponent, ReportesMeterComponent, ReportesEmphasisComponent],
  providers: [ReportesChartService],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export default class ReportesComponent {
  private readonly authStore = inject(AuthStore);
  private readonly reportesService = inject(ReportesClinicosService);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly companyService = inject(CompanyService);
  private readonly productoService = inject(ProductoService);
  private readonly categoriaProductoService = inject(CategoriaProductoService);
  private readonly marcaProductoService = inject(MarcaProductoService);
  private readonly chartService = inject(ReportesChartService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloadReports = new Subject<void>();
  private exportServicePromise: Promise<ReportesExportService> | null = null;
  private readonly chartCanvases =
    viewChildren<ElementRef<HTMLCanvasElement>>('reportChart');
  readonly selectedCompanyId = computed(() =>
    this.authStore.selectedEnterprise()?.establishmentId
      ?? this.authStore.companyId()
      ?? undefined
  );

  /** Administración de plataforma sin una empresa activa seleccionada: no hay "un" reporte que
   * mostrar (mezclar cifras de empresas distintas sería engañoso), así que se muestra el
   * comparativo por empresa en su lugar. Ver `comparativo` más abajo. */
  readonly isPlatformAdmin = computed(() => this.authStore.activeRolePurpose() === 'PLATFORM_ADMIN');
  readonly verComparativoEmpresas = computed(() => this.isPlatformAdmin() && this.selectedCompanyId() == null);

  /** Igual que en Agenda: un usuario con alcance propio (OWN) solo ve sus propios datos aunque
   * el backend ignore lo que elija aquí — el filtro "Todos"/otros nombres es engañoso si se
   * muestra de todas formas, así que se oculta y se fija a su propio empleado. */
  readonly canViewAllCitas = computed(() =>
    this.authStore.dataScope('VISTA_REPORTES') === 'COMPANY'
  );
  readonly data = signal<ReportesClinicos | null>(null);
  readonly comparativo = signal<ReportesComparativoEmpresas | null>(null);
  readonly pacientesInactivos = signal<PacientesInactivosPage | null>(null);
  readonly ventasProductos = signal<ReporteVentasProductos | null>(null);
  readonly tipoReporte = signal<'CLINICA' | 'VENTAS_PRODUCTOS'>('CLINICA');
  readonly pacientesInactivosPage = signal(0);
  private readonly pacientesInactivosPageSize = 10;
  readonly veterinarios = signal<EmpleadoListResponse[]>([]);
  readonly companyInfo = signal<CompanyDTO | null>(null);
  readonly productos = signal<ProductoResponse[]>([]);
  readonly categorias = signal<CategoriaProductoResponse[]>([]);
  readonly marcas = signal<MarcaProductoResponse[]>([]);
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

  periodo: Periodo = 'hoy';
  fechaDesde = '';
  fechaHasta = '';
  veterinarioId: number | null = null;
  especie = '';
  metodoPago = '';
  categoriaId: number | null = null;
  productoId: number | null = null;
  marcaId: number | null = null;
  estadoStock = '';

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

    if (!this.canViewAllCitas() && this.authStore.empleadoId()) {
      this.veterinarioId = this.authStore.empleadoId() ?? null;
    }

    const companyId$ = toObservable(this.selectedCompanyId).pipe(
      distinctUntilChanged()
    );
    const tipoReporte$ = toObservable(this.tipoReporte).pipe(distinctUntilChanged());

    companyId$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.pacientesInactivosPage.set(0));

    combineLatest([companyId$, tipoReporte$])
      .pipe(
        switchMap(([companyId, tipo]) =>
          tipo === 'CLINICA'
            ? this.empleadoService.listar(companyId, undefined, 0, 200).pipe(
            catchError(() => EMPTY)
          )
            : EMPTY
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        const empleados = response.data.content ?? [];
        this.veterinarios.set(
          empleados.filter(empleado =>
            empleado.activo
            && empleado.tiposEmpleado?.some(tipo => tipo.trim().toUpperCase() === 'VETERINARIO')
          )
        );
      });

    companyId$
      .pipe(
        switchMap(companyId =>
          companyId == null
            ? EMPTY
            : this.companyService.getById(companyId).pipe(catchError(() => EMPTY))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => this.companyInfo.set(response.data));

    combineLatest([companyId$, tipoReporte$])
      .pipe(
        switchMap(([companyId, tipo]) => companyId == null || tipo !== 'VENTAS_PRODUCTOS'
          ? EMPTY
          : combineLatest([
              this.productoService.listarActivos(companyId).pipe(catchError(() => of({ success: false, message: '', data: [] }))),
              this.categoriaProductoService.listarActivas(companyId).pipe(catchError(() => of({ success: false, message: '', data: [] }))),
              this.marcaProductoService.listarActivas(companyId).pipe(catchError(() => of({ success: false, message: '', data: [] })))
            ])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(([productos, categorias, marcas]) => {
        this.productos.set(productos.data ?? []);
        this.categorias.set(categorias.data ?? []);
        this.marcas.set(marcas.data ?? []);
      });

    combineLatest([
      companyId$,
      tipoReporte$,
      this.reloadReports.pipe(startWith(undefined))
    ])
      .pipe(
        switchMap(([companyId, tipo]) =>
          tipo === 'CLINICA'
            ? this.reportesService.obtenerReportes(this.buildFilters(companyId)).pipe(
                catchError(() => EMPTY)
              )
            : EMPTY
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => this.data.set(response.data));

    combineLatest([
      companyId$,
      tipoReporte$,
      this.reloadReports.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([companyId, tipo]) => tipo === 'VENTAS_PRODUCTOS' && companyId != null
        ? this.reportesService.obtenerVentasProductos(this.buildVentasFilters(companyId)).pipe(catchError(() => EMPTY))
        : EMPTY),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => this.ventasProductos.set(response.data));

    combineLatest([
      toObservable(this.verComparativoEmpresas),
      this.reloadReports.pipe(startWith(undefined))
    ])
      .pipe(
        switchMap(([verComparativo]) =>
          verComparativo
            ? this.reportesService
                .obtenerComparativoEmpresas(this.fechaDesde, this.fechaHasta, this.especie || undefined)
                .pipe(catchError(() => EMPTY))
            : EMPTY
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => this.comparativo.set(response.data));

    combineLatest([
      companyId$,
      tipoReporte$,
      toObservable(this.pacientesInactivosPage),
      this.reloadReports.pipe(startWith(undefined))
    ])
      .pipe(
        switchMap(([companyId, tipo, page]) =>
          companyId == null || tipo !== 'CLINICA'
            ? EMPTY
            : this.reportesService
                .obtenerPacientesInactivos(companyId, page, this.pacientesInactivosPageSize)
                .pipe(catchError(() => EMPTY))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => this.pacientesInactivos.set(response.data));

    afterRenderEffect(() => {
      const reporte = this.data();
      const canvases = this.chartCanvases().map(reference => reference.nativeElement);

      if (reporte && !this.verComparativoEmpresas()) {
        this.chartService.render(reporte, canvases);
      } else {
        this.chartService.destroy();
      }
    });
  }

  onFiltrosChange(): void {
    if (this.periodo === 'personalizado') return;
    this.actualizarRangoSeleccionado();
    this.pacientesInactivosPage.set(0);
    this.reloadReports.next();
  }

  cambiarTipoReporte(tipo: 'CLINICA' | 'VENTAS_PRODUCTOS'): void {
    this.tipoReporte.set(tipo);
  }

  aplicarFiltros(): void {
    if (!this.rangoValido()) return;
    this.pacientesInactivosPage.set(0);
    this.reloadReports.next();
  }

  limpiarFiltros(): void {
    this.periodo = 'hoy';
    this.veterinarioId = null;
    this.especie = '';
    this.metodoPago = '';
    this.categoriaId = null;
    this.productoId = null;
    this.marcaId = null;
    this.estadoStock = '';
    this.actualizarRangoSeleccionado();
    this.pacientesInactivosPage.set(0);
    this.reloadReports.next();
  }

  cambiarPaginaInactivos(delta: number): void {
    const pagina = this.pacientesInactivos();
    if (!pagina) return;
    const nueva = this.pacientesInactivosPage() + delta;
    if (nueva < 0 || nueva >= pagina.totalPages) return;
    this.pacientesInactivosPage.set(nueva);
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
    if (this.tipoReporte() === 'VENTAS_PRODUCTOS') {
      const reporteVentas = this.ventasProductos();
      if (!reporteVentas) return;
      const exportService = await this.getExportService();
      await exportService.exportarVentasPdf(reporteVentas, this.companyInfo(), this.descripcionFiltrosVentas());
      return;
    }
    const reporte = this.data();
    if (!reporte) return;
    const exportService = await this.getExportService();
    const empresa = this.companyInfo();
    const logoDataUrl = empresa?.logoUrl ? await this.descargarComoDataUrl(empresa.logoUrl) : null;
    await exportService.exportarPdf(reporte, this.chartImagenesPorNombre(), empresa, logoDataUrl);
  }

  private async descargarComoDataUrl(url: string): Promise<string | null> {
    try {
      const blob = await fetch(url).then(r => r.blob());
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private chartImagenesPorNombre(): Map<string, ReportChartImage> {
    const imagenes = new Map<string, ReportChartImage>();
    for (const ref of this.chartCanvases()) {
      const canvas = ref.nativeElement;
      const nombre = canvas.dataset['reportChart'];
      if (nombre && canvas.width > 0 && canvas.height > 0) {
        imagenes.set(nombre, {
          dataUrl: canvas.toDataURL('image/png', 1.0),
          width: canvas.width,
          height: canvas.height
        });
      }
    }
    return imagenes;
  }

  async exportarExcel(): Promise<void> {
    if (this.tipoReporte() === 'VENTAS_PRODUCTOS') {
      const reporteVentas = this.ventasProductos();
      if (!reporteVentas) return;
      const exportService = await this.getExportService();
      await exportService.exportarVentasExcel(reporteVentas, this.companyInfo(), this.descripcionFiltrosVentas());
      return;
    }
    const reporte = this.data();
    if (!reporte) return;
    const exportService = await this.getExportService();
    const empresa = this.companyInfo();
    const logoDataUrl = empresa?.logoUrl ? await this.descargarComoDataUrl(empresa.logoUrl) : null;
    await exportService.exportarExcel(reporte, empresa, logoDataUrl);
  }

  private getExportService(): Promise<ReportesExportService> {
    if (!this.exportServicePromise) {
      this.exportServicePromise = import('./reportes-export.service')
        .then(({ ReportesExportService: Service }) => this.injector.get(Service));
    }
    return this.exportServicePromise;
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

  private buildVentasFilters(companyId: number) {
    return {
      companyId,
      fechaDesde: this.fechaDesde,
      fechaHasta: this.fechaHasta,
      metodoPago: (this.metodoPago || undefined) as 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | undefined,
      categoriaId: this.categoriaId ?? undefined,
      productoId: this.productoId ?? undefined,
      marcaId: this.marcaId ?? undefined,
      estadoStock: (this.estadoStock || undefined) as 'NORMAL' | 'BAJO' | 'SIN_STOCK' | undefined
    };
  }

  private descripcionFiltrosVentas(): string {
    const categoria = this.categorias().find(item => item.id === this.categoriaId)?.nombre;
    const producto = this.productos().find(item => item.id === this.productoId)?.nombre;
    const marca = this.marcas().find(item => item.id === this.marcaId)?.nombre;
    const estado = ({ NORMAL: 'Normal', BAJO: 'Stock bajo', SIN_STOCK: 'Sin stock' } as Record<string, string>)[this.estadoStock];
    return [
      this.metodoPago ? `Método: ${this.metodoPago}` : null,
      categoria ? `Categoría: ${categoria}` : null,
      producto ? `Producto: ${producto}` : null,
      marca ? `Marca: ${marca}` : null,
      estado ? `Stock: ${estado}` : null
    ].filter((item): item is string => item != null).join(' · ') || 'Sin filtros adicionales';
  }
}
