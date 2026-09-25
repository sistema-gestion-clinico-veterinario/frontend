import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductoService } from '../../../core/services/producto.service';
import { ProductoResponse } from '../../../models/response/producto-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, PaginatorModule, SkeletonModule, ToastModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './productos.component.html'
})
export class ProductosComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly productoService = inject(ProductoService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private lastLoadedCompanyId: number | null | undefined = undefined;

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
        this.cargando.set(false);
        return;
      }
      this.loadProductos();
    });
  }

  cargando          = signal<boolean>(true);
  productos         = signal<ProductoResponse[]>([]);
  productosTotal    = signal(0);
  productosPage     = signal(0);
  readonly pageSize = 10;

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
    this.productoService.listar(cid, page, this.pageSize).subscribe({
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

  nuevoProducto() {
    this.router.navigate(['/admin/productos/nuevo']);
  }

  editarProducto(item: ProductoResponse) {
    this.router.navigate(['/admin/productos', item.id, 'editar']);
  }

  openConfirm(title: string, message: string, action: string, item: ProductoResponse, variant: 'primary' | 'warning' | 'danger', confirmLabel: string) {
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
      case 'eliminar': this.eliminar(ctx.item.id); break;
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

  toggleActivo(item: ProductoResponse) {
    this.loadingStore.show();
    this.productoService.toggleActivo(item.id).subscribe({
      next: () => {
        this.loadProductos(this.productosPage());
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado del producto actualizado' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminar(id: number) {
    this.loadingStore.show();
    this.productoService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Producto eliminado correctamente' });
        this.loadProductos(this.productosPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el producto' });
        this.loadingStore.hide();
      }
    });
  }
}
