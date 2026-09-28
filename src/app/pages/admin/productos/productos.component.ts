import { Component, HostListener, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { Subject, debounceTime } from 'rxjs';
import { ProductoService } from '../../../core/services/producto.service';
import { LoteService } from '../../../core/services/lote.service';
import { CategoriaProductoService } from '../../../core/services/categoria-producto.service';
import { ProductoResponse } from '../../../models/response/producto-response';
import { AlertaVencimientoResponse } from '../../../models/response/alerta-vencimiento-response';
import { CategoriaProductoResponse } from '../../../models/response/categoria-producto-response';
import { CategoriaConteoResponse } from '../../../models/response/categoria-conteo-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatorModule, SkeletonModule, ToastModule, TooltipModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './productos.component.html'
})
export class ProductosComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly productoService = inject(ProductoService);
  private readonly loteService = inject(LoteService);
  private readonly categoriaProductoService = inject(CategoriaProductoService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private lastLoadedCompanyId: number | null | undefined = undefined;
  private readonly searchTrigger = new Subject<void>();

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  get requiresCompanySelection(): boolean {
    return this.authStore.isSuperAdmin() && !this.activeCompanyId;
  }

  constructor() {
    effect(() => {
      const companyId = this.activeCompanyId;
      if (this.lastLoadedCompanyId === companyId) return;
      this.lastLoadedCompanyId = companyId;
      this.productosPage.set(0);

      if (!companyId) {
        this.productos.set([]);
        this.productosTotal.set(0);
        this.alertaVencimiento.set(null);
        this.cargando.set(false);
        return;
      }
      this.loadProductos();
      this.loadAlertaVencimiento();
      this.loadCategorias();
      this.loadConteoPorCategoria();
    });

    this.searchTrigger.pipe(debounceTime(400)).subscribe(() => this.loadProductos(0));
  }

  cargando          = signal<boolean>(true);
  productos         = signal<ProductoResponse[]>([]);
  productosTotal    = signal(0);
  productosPage     = signal(0);
  readonly pageSize = 12;

  categorias        = signal<CategoriaProductoResponse[]>([]);
  categoriaConteos  = signal<CategoriaConteoResponse[]>([]);
  searchQuery       = signal('');
  categoriaFiltro   = signal<number | null>(null);
  estadoFiltro      = signal<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');

  readonly categoriaIconos: Record<string, string> = {
    alimento: 'pi-shopping-bag',
    medicamento: 'pi-heart',
    higiene: 'pi-sparkles',
    cuidado: 'pi-sparkles',
    accesorio: 'pi-box',
    suplemento: 'pi-bolt',
    juguete: 'pi-star'
  };

  categoriaIcon(nombre: string): string {
    const key = Object.keys(this.categoriaIconos).find(k => nombre.toLowerCase().includes(k));
    return key ? this.categoriaIconos[key] : 'pi-tag';
  }

  totalActivos(): number {
    return this.categoriaConteos().reduce((sum, c) => sum + c.cantidad, 0);
  }

  alertaVencimiento = signal<AlertaVencimientoResponse | null>(null);
  showAlertaDetalle = signal(false);
  menuProductoId = signal<number | null>(null);

  confirmDialog = signal<{
    title: string;
    message: string;
    action: string;
    item: ProductoResponse;
    variant: 'primary' | 'warning' | 'danger';
    confirmLabel: string;
  } | null>(null);

  ngOnInit() {
    setTimeout(() => this.cargando.set(false), 300);
  }

  private pageTotal(data: any): number {
    return data?.page?.totalElements ?? data?.totalElements ?? 0;
  }

  loadProductos(page = this.productosPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    const activo = this.estadoFiltro() === 'TODOS' ? undefined : this.estadoFiltro() === 'ACTIVO';
    this.productoService.listar(cid, page, this.pageSize, this.searchQuery() || undefined, this.categoriaFiltro() ?? undefined, activo).subscribe({
      next: (res) => {
        this.productos.set(res.data.content || []);
        this.productosTotal.set(this.pageTotal(res.data));
        this.productosPage.set(page);
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los productos' });
        this.cargando.set(false);
      }
    });
  }

  onPageChange(event: any) {
    this.loadProductos(Number(event.page) || 0);
  }

  loadCategorias() {
    if (!this.activeCompanyId) return;
    this.categoriaProductoService.listarActivas(this.activeCompanyId ?? undefined).subscribe({
      next: (res) => this.categorias.set(res.data ?? []),
      error: () => {}
    });
  }

  loadConteoPorCategoria() {
    if (!this.activeCompanyId) return;
    this.productoService.conteoPorCategoria(this.activeCompanyId ?? undefined).subscribe({
      next: (res) => this.categoriaConteos.set(res.data ?? []),
      error: () => {}
    });
  }

  onSearchChange(value: string) {
    this.searchQuery.set(value);
    this.searchTrigger.next();
  }

  selectCategoria(id: number | null) {
    this.categoriaFiltro.set(id);
    this.loadProductos(0);
  }

  onCategoriaFiltroChange(value: string | number | null) {
    const categoriaId = value === null || value === '' ? null : Number(value);
    this.selectCategoria(Number.isFinite(categoriaId) ? categoriaId : null);
  }

  onEstadoFiltroChange(value: string) {
    this.estadoFiltro.set(value as 'TODOS' | 'ACTIVO' | 'INACTIVO');
    this.loadProductos(0);
  }

  limpiarFiltros() {
    this.searchQuery.set('');
    this.categoriaFiltro.set(null);
    this.estadoFiltro.set('TODOS');
    this.loadProductos(0);
  }

  loadAlertaVencimiento() {
    if (!this.activeCompanyId) return;
    this.loteService.alertas(this.activeCompanyId ?? undefined).subscribe({
      next: (res) => this.alertaVencimiento.set(res.data),
      error: () => {}
    });
  }

  loteVencido(fecha?: string): boolean {
    if (!fecha) return false;
    return new Date(fecha) < new Date(new Date().toDateString());
  }

  loteProntoAVencer(fecha?: string): boolean {
    if (!fecha) return false;
    const dias = (new Date(fecha).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000;
    return dias >= 0 && dias <= 30;
  }

  nuevoProducto() {
    this.router.navigate(['/admin/productos/nuevo']);
  }

  puedeGestionarProductos(): boolean {
    return this.authStore.hasAccess('VISTA_PRODUCTOS', 'modificar') ||
      this.authStore.hasAccess('VISTA_PRODUCTOS', 'eliminar');
  }

  toggleMenuProducto(id: number) {
    this.menuProductoId.set(this.menuProductoId() === id ? null : id);
  }

  @HostListener('document:click')
  cerrarMenuProducto() {
    if (this.menuProductoId() !== null) {
      this.menuProductoId.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  cerrarMenuProductoConEscape() {
    this.menuProductoId.set(null);
  }

  private skuPublico(item: ProductoResponse): string | null {
    const sku = item.sku?.trim();
    if (sku) return sku;

    this.messageService.add({
      severity: 'error',
      summary: 'Producto no disponible',
      detail: 'No se encontró el código del producto seleccionado. Recarga el catálogo e inténtalo nuevamente.'
    });
    return null;
  }

  verProducto(item: ProductoResponse) {
    this.menuProductoId.set(null);
    const sku = this.skuPublico(item);
    if (!sku) return;
    this.router.navigate(['/admin/productos', sku, 'detalle']);
  }

  editarProducto(item: ProductoResponse) {
    this.menuProductoId.set(null);
    const sku = this.skuPublico(item);
    if (!sku) return;
    this.router.navigate(['/admin/productos', sku, 'editar']);
  }

  openConfirm(title: string, message: string, action: string, item: ProductoResponse, variant: 'primary' | 'warning' | 'danger', confirmLabel: string) {
    this.menuProductoId.set(null);
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
      case 'toggle': this.toggleActivo(ctx.item); break;
      case 'eliminar': this.eliminar(ctx.item); break;
    }
  }

  confirmIconClass(): string {
    const variant = this.confirmDialog()?.variant;
    if (variant === 'danger') return 'bg-red-50 text-red-500';
    if (variant === 'warning') return 'bg-amber-50 text-amber-500';
    return 'bg-blue-50 text-blue-500';
  }

  confirmButtonClass(): string {
    const variant = this.confirmDialog()?.variant;
    const base = 'px-4 py-2 rounded-lg text-white text-sm font-medium';
    if (variant === 'danger') return `${base} bg-red-600 hover:bg-red-700`;
    if (variant === 'warning') return `${base} bg-amber-600 hover:bg-amber-700`;
    return `${base} bg-blue-500 hover:bg-blue-600`;
  }

  toggleActivo(item: ProductoResponse) {
    const sku = this.skuPublico(item);
    if (!sku) return;
    this.loadingStore.show();
    this.productoService.toggleActivo(sku, item.companyId).subscribe({
      next: () => {
        this.loadProductos(this.productosPage());
        this.loadConteoPorCategoria();
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado del producto actualizado' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminar(item: ProductoResponse) {
    const sku = this.skuPublico(item);
    if (!sku) return;
    this.loadingStore.show();
    this.productoService.eliminar(sku, item.companyId).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Producto eliminado correctamente' });
        this.loadProductos(this.productosPage());
        this.loadConteoPorCategoria();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el producto' });
        this.loadingStore.hide();
      }
    });
  }
}
