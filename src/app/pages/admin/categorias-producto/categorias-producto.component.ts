import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CategoriaProductoService } from '../../../core/services/categoria-producto.service';
import { CategoriaProductoResponse } from '../../../models/response/categoria-producto-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';

@Component({
  selector: 'app-categorias-producto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaginatorModule, SkeletonModule, ToastModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './categorias-producto.component.html'
})
export class CategoriasProductoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoriaProductoService = inject(CategoriaProductoService);
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
      this.categoriasPage.set(0);

      if (!companyId) {
        this.categorias.set([]);
        this.categoriasTotal.set(0);
        this.cargando.set(false);
        return;
      }
      this.loadCategorias();
    });
  }

  cargando        = signal<boolean>(true);
  categorias      = signal<CategoriaProductoResponse[]>([]);
  categoriasTotal = signal(0);
  categoriasPage  = signal(0);
  readonly pageSize = 10;

  showModal = signal(false);
  editing   = signal<CategoriaProductoResponse | null>(null);
  confirmDialog = signal<{
    title: string;
    message: string;
    action: string;
    item: CategoriaProductoResponse;
    variant: 'primary' | 'warning' | 'danger';
    confirmLabel: string;
  } | null>(null);

  categoriaForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: true })]]
  });

  ngOnInit() {
    setTimeout(() => this.cargando.set(false), 300);
  }

  private pageTotal(data: any): number {
    return data?.page?.totalElements ?? data?.totalElements ?? 0;
  }

  loadCategorias(page = this.categoriasPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.categoriaProductoService.listar(cid, page, this.pageSize).subscribe({
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

  onPageChange(event: any) {
    this.loadCategorias(Number(event.page) || 0);
  }

  openModal(item?: CategoriaProductoResponse) {
    this.editing.set(item ?? null);
    this.categoriaForm.reset({ nombre: item?.nombre ?? '' });
    this.showModal.set(true);
  }

  guardar() {
    if (this.categoriaForm.invalid) { this.categoriaForm.markAllAsTouched(); return; }
    const val = this.categoriaForm.value;
    const companyId = this.activeCompanyId;
    const payload = { ...val, ...(companyId ? { companyId } : {}) };

    const editingItem = this.editing();
    const req = editingItem
      ? this.categoriaProductoService.actualizar(editingItem.id, payload)
      : this.categoriaProductoService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editingItem ? 'Categoría actualizada' : 'Categoría creada' });
        this.showModal.set(false);
        this.loadCategorias(editingItem ? this.categoriasPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  openConfirm(title: string, message: string, action: string, item: CategoriaProductoResponse, variant: 'primary' | 'warning' | 'danger', confirmLabel: string) {
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

  toggleActivo(item: CategoriaProductoResponse) {
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

  eliminar(id: number) {
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
}
