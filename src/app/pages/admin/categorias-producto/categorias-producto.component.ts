import { Component, DestroyRef, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CategoriaProductoService } from '../../../core/services/categoria-producto.service';
import { CategoriaProductoResponse } from '../../../models/response/categoria-producto-response';
import { UnidadMedidaService } from '../../../core/services/unidad-medida.service';
import { UnidadMedidaResponse } from '../../../models/response/unidad-medida-response';
import { MarcaProductoService } from '../../../core/services/marca-producto.service';
import { MarcaProductoResponse } from '../../../models/response/marca-producto-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type Tab = 'categorias' | 'marcas' | 'unidades';

interface ConfirmContext<T> {
  title: string;
  message: string;
  action: string;
  item: T;
  variant: 'primary' | 'warning' | 'danger';
  confirmLabel: string;
}

@Component({
  selector: 'app-categorias-producto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginatorModule, SkeletonModule, ToastModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './categorias-producto.component.html'
})
export class CategoriasProductoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly categoriaProductoService = inject(CategoriaProductoService);
  private readonly unidadMedidaService = inject(UnidadMedidaService);
  private readonly marcaProductoService = inject(MarcaProductoService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTrigger = new Subject<void>();
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private lastLoadedCompanyId: number | null | undefined = undefined;

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  get requiresCompanySelection(): boolean {
    return this.authStore.isSuperAdmin() && !this.activeCompanyId;
  }

  activeTab = signal<Tab>('categorias');
  searchQuery = signal('');
  estadoFiltro = signal<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');

  constructor() {
    this.searchTrigger.pipe(
      debounceTime(350),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.reloadActiveTab(0));

    effect(() => {
      const companyId = this.activeCompanyId;
      if (this.lastLoadedCompanyId === companyId) return;
      this.lastLoadedCompanyId = companyId;
      this.categoriasPage.set(0);
      this.marcasPage.set(0);
      this.unidadesPage.set(0);

      if (!companyId) {
        this.categorias.set([]);
        this.categoriasTotal.set(0);
        this.unidades.set([]);
        this.unidadesTotal.set(0);
        this.marcas.set([]);
        this.marcasTotal.set(0);
        this.cargando.set(false);
        return;
      }
      this.loadCategorias();
      this.loadMarcas();
      this.loadUnidades();
    });
  }

  cargando = signal<boolean>(true);

  // --- Categorías ---
  categorias      = signal<CategoriaProductoResponse[]>([]);
  categoriasTotal = signal(0);
  categoriasPage  = signal(0);

  showCategoriaModal = signal(false);
  editingCategoria    = signal<CategoriaProductoResponse | null>(null);
  categoriaForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: true })]],
    descripcion: ['', [Validators.maxLength(300)]]
  });

  // --- Unidades de medida ---
  unidades      = signal<UnidadMedidaResponse[]>([]);
  unidadesTotal = signal(0);
  unidadesPage  = signal(0);

  showUnidadModal = signal(false);
  editingUnidad    = signal<UnidadMedidaResponse | null>(null);
  unidadForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(40), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: true })]],
    descripcion: ['', [Validators.maxLength(300)]]
  });

  // --- Marcas ---
  marcas      = signal<MarcaProductoResponse[]>([]);
  marcasTotal = signal(0);
  marcasPage  = signal(0);

  showMarcaModal = signal(false);
  editingMarca    = signal<MarcaProductoResponse | null>(null);
  marcaForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: true })]],
    descripcion: ['', [Validators.maxLength(300)]]
  });

  readonly pageSize = 10;

  confirmDialog = signal<ConfirmContext<CategoriaProductoResponse | UnidadMedidaResponse | MarcaProductoResponse> | null>(null);

  ngOnInit() {
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'unidades' || tabParam === 'marcas') this.activeTab.set(tabParam);
    setTimeout(() => this.cargando.set(false), 300);
  }

  private pageTotal(data: any): number {
    return data?.page?.totalElements ?? data?.totalElements ?? 0;
  }

  // --- Categorías: CRUD ---

  loadCategorias(page = this.categoriasPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.categoriaProductoService.listar(cid, page, this.pageSize, this.searchQuery(), this.activeFilter()).subscribe({
      next: (res) => {
        this.categorias.set(res.data.content || []);
        this.categoriasTotal.set(this.pageTotal(res.data));
        this.categoriasPage.set(page);
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las categorías' });
        this.cargando.set(false);
      }
    });
  }

  onCategoriasPageChange(event: any) {
    this.loadCategorias(Number(event.page) || 0);
  }

  openCategoriaModal(item?: CategoriaProductoResponse) {
    this.editingCategoria.set(item ?? null);
    this.categoriaForm.reset({ nombre: item?.nombre ?? '', descripcion: item?.descripcion ?? '' });
    this.showCategoriaModal.set(true);
  }

  guardarCategoria() {
    if (this.categoriaForm.invalid) { this.categoriaForm.markAllAsTouched(); return; }
    const val = this.categoriaForm.value;
    const companyId = this.activeCompanyId;
    const payload = { ...val, ...(companyId ? { companyId } : {}) };

    const editingItem = this.editingCategoria();
    const req = editingItem
      ? this.categoriaProductoService.actualizar(editingItem.id, payload)
      : this.categoriaProductoService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editingItem ? 'Categoría actualizada' : 'Categoría creada' });
        this.showCategoriaModal.set(false);
        this.loadCategorias(editingItem ? this.categoriasPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  toggleActivoCategoria(item: CategoriaProductoResponse) {
    this.loadingStore.show();
    this.categoriaProductoService.toggleActivo(item.id).subscribe({
      next: () => {
        this.loadCategorias(this.categoriasPage());
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado de la categoría actualizado' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarCategoria(id: number) {
    this.loadingStore.show();
    this.categoriaProductoService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Categoría eliminada correctamente' });
        this.loadCategorias(this.categoriasPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la categoría' });
        this.loadingStore.hide();
      }
    });
  }

  // --- Unidades de medida: CRUD ---

  loadUnidades(page = this.unidadesPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.unidadMedidaService.listar(cid, page, this.pageSize, this.searchQuery(), this.activeFilter()).subscribe({
      next: (res) => {
        this.unidades.set(res.data.content || []);
        this.unidadesTotal.set(this.pageTotal(res.data));
        this.unidadesPage.set(page);
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las unidades de medida' });
        this.cargando.set(false);
      }
    });
  }

  onUnidadesPageChange(event: any) {
    this.loadUnidades(Number(event.page) || 0);
  }

  onSearchChange(value: string) {
    this.searchQuery.set(value);
    this.searchTrigger.next();
  }

  onEstadoFiltroChange(value: string) {
    this.estadoFiltro.set(value as 'TODOS' | 'ACTIVO' | 'INACTIVO');
    this.reloadActiveTab(0);
  }

  limpiarFiltros() {
    this.searchQuery.set('');
    this.estadoFiltro.set('TODOS');
    this.reloadActiveTab(0);
  }

  cambiarTab(tab: Tab) {
    this.activeTab.set(tab);
    this.reloadActiveTab(0);
  }

  private activeFilter(): boolean | undefined {
    if (this.estadoFiltro() === 'ACTIVO') return true;
    if (this.estadoFiltro() === 'INACTIVO') return false;
    return undefined;
  }

  private reloadActiveTab(page = 0) {
    if (this.activeTab() === 'categorias') this.loadCategorias(page);
    else if (this.activeTab() === 'marcas') this.loadMarcas(page);
    else this.loadUnidades(page);
  }

  // --- Marcas: CRUD ---

  loadMarcas(page = this.marcasPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.marcaProductoService.listar(cid, page, this.pageSize, this.searchQuery(), this.activeFilter()).subscribe({
      next: (res) => {
        this.marcas.set(res.data.content || []);
        this.marcasTotal.set(this.pageTotal(res.data));
        this.marcasPage.set(page);
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las marcas' });
        this.cargando.set(false);
      }
    });
  }

  onMarcasPageChange(event: any) {
    this.loadMarcas(Number(event.page) || 0);
  }

  openMarcaModal(item?: MarcaProductoResponse) {
    this.editingMarca.set(item ?? null);
    this.marcaForm.reset({ nombre: item?.nombre ?? '', descripcion: item?.descripcion ?? '' });
    this.showMarcaModal.set(true);
  }

  guardarMarca() {
    if (this.marcaForm.invalid) { this.marcaForm.markAllAsTouched(); return; }
    const companyId = this.activeCompanyId;
    const payload = { ...this.marcaForm.value, ...(companyId ? { companyId } : {}) };
    const editingItem = this.editingMarca();
    const req = editingItem
      ? this.marcaProductoService.actualizar(editingItem.id, payload)
      : this.marcaProductoService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editingItem ? 'Marca actualizada' : 'Marca creada' });
        this.showMarcaModal.set(false);
        this.loadMarcas(editingItem ? this.marcasPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar la marca' });
        this.loadingStore.hide();
      }
    });
  }

  toggleActivoMarca(item: MarcaProductoResponse) {
    this.loadingStore.show();
    this.marcaProductoService.toggleActivo(item.id).subscribe({
      next: () => {
        this.loadMarcas(this.marcasPage());
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado de la marca actualizado' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarMarca(id: number) {
    this.loadingStore.show();
    this.marcaProductoService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Marca eliminada correctamente' });
        this.loadMarcas(this.marcasPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la marca' });
        this.loadingStore.hide();
      }
    });
  }

  openUnidadModal(item?: UnidadMedidaResponse) {
    this.editingUnidad.set(item ?? null);
    this.unidadForm.reset({ nombre: item?.nombre ?? '', descripcion: item?.descripcion ?? '' });
    this.showUnidadModal.set(true);
  }

  guardarUnidad() {
    if (this.unidadForm.invalid) { this.unidadForm.markAllAsTouched(); return; }
    const val = this.unidadForm.value;
    const companyId = this.activeCompanyId;
    const payload = { ...val, ...(companyId ? { companyId } : {}) };

    const editingItem = this.editingUnidad();
    const req = editingItem
      ? this.unidadMedidaService.actualizar(editingItem.id, payload)
      : this.unidadMedidaService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editingItem ? 'Unidad de medida actualizada' : 'Unidad de medida creada' });
        this.showUnidadModal.set(false);
        this.loadUnidades(editingItem ? this.unidadesPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  toggleActivoUnidad(item: UnidadMedidaResponse) {
    this.loadingStore.show();
    this.unidadMedidaService.toggleActivo(item.id).subscribe({
      next: () => {
        this.loadUnidades(this.unidadesPage());
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado de la unidad de medida actualizado' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarUnidad(id: number) {
    this.loadingStore.show();
    this.unidadMedidaService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Unidad de medida eliminada correctamente' });
        this.loadUnidades(this.unidadesPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la unidad de medida' });
        this.loadingStore.hide();
      }
    });
  }

  // --- Confirmación compartida ---

  openConfirm(title: string, message: string, action: string, item: CategoriaProductoResponse | UnidadMedidaResponse | MarcaProductoResponse, variant: 'primary' | 'warning' | 'danger', confirmLabel: string) {
    this.confirmDialog.set({ title, message, action, item, variant, confirmLabel });
  }

  cancelConfirm() {
    this.confirmDialog.set(null);
  }

  confirmAction() {
    const ctx = this.confirmDialog();
    if (!ctx) return;
    this.cancelConfirm();
    switch (ctx.action) {
      case 'toggle-categoria': this.toggleActivoCategoria(ctx.item as CategoriaProductoResponse); break;
      case 'eliminar-categoria': this.eliminarCategoria(ctx.item.id); break;
      case 'toggle-unidad': this.toggleActivoUnidad(ctx.item as UnidadMedidaResponse); break;
      case 'eliminar-unidad': this.eliminarUnidad(ctx.item.id); break;
      case 'toggle-marca': this.toggleActivoMarca(ctx.item as MarcaProductoResponse); break;
      case 'eliminar-marca': this.eliminarMarca(ctx.item.id); break;
    }
  }

  confirmIconClass(): string {
    const variant = this.confirmDialog()?.variant;
    if (variant === 'danger') return 'bg-red-50 text-red-500';
    if (variant === 'warning') return 'bg-amber-50 text-amber-500';
    return 'bg-blue-50 text-[#0066AA]';
  }

  confirmButtonClass(): string {
    const variant = this.confirmDialog()?.variant;
    const base = 'px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors';
    if (variant === 'danger') return `${base} bg-red-600 hover:bg-red-700`;
    if (variant === 'warning') return `${base} bg-amber-600 hover:bg-amber-700`;
    return `${base} bg-[#0066AA] hover:bg-[#005a96]`;
  }
}
