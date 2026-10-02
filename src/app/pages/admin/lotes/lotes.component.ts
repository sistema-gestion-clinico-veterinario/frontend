import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Subject, debounceTime } from 'rxjs';
import { LoteService } from '../../../core/services/lote.service';
import { ProductoService } from '../../../core/services/producto.service';
import { LoteResponse } from '../../../models/response/lote-response';
import { ProductoResponse } from '../../../models/response/producto-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-lotes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginatorModule, SkeletonModule, ToastModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './lotes.component.html'
})
export class LotesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly loteService = inject(LoteService);
  private readonly productoService = inject(ProductoService);
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
      this.lotesPage.set(0);

      if (!companyId) {
        this.lotes.set([]);
        this.lotesTotal.set(0);
        this.productos.set([]);
        this.cargando.set(false);
        return;
      }
      this.loadLotes();
      this.loadProductos();
    });

    this.searchTrigger.pipe(debounceTime(400)).subscribe(() => this.loadLotes(0));
  }

  cargando        = signal<boolean>(true);
  lotes           = signal<LoteResponse[]>([]);
  lotesTotal      = signal(0);
  lotesPage       = signal(0);
  readonly pageSize = 15;

  productos       = signal<ProductoResponse[]>([]);
  searchQuery     = signal('');

  showModal    = signal(false);
  editingLote  = signal<LoteResponse | null>(null);
  guardando    = signal(false);

  confirmDialog = signal<{
    title: string;
    message: string;
    action: string;
    item: LoteResponse;
    variant: 'primary' | 'warning' | 'danger';
    confirmLabel: string;
  } | null>(null);

  loteForm: FormGroup = this.fb.group({
    productoId: [null, Validators.required],
    numeroLote: ['', [Validators.required, Validators.maxLength(60), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    fechaVencimiento: ['', Validators.required],
    fechaIngreso: [''],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    costoUnitario: [null, [Validators.min(0)]]
  });

  ngOnInit() {
    setTimeout(() => this.cargando.set(false), 300);
  }

  private pageTotal(data: any): number {
    return data?.page?.totalElements ?? data?.totalElements ?? 0;
  }

  loadLotes(page = this.lotesPage()) {
    if (!this.activeCompanyId) return;
    this.loteService.listar(this.activeCompanyId ?? undefined, this.searchQuery() || undefined, page, this.pageSize).subscribe({
      next: (res) => {
        this.lotes.set(res.data.content || []);
        this.lotesTotal.set(this.pageTotal(res.data));
        this.lotesPage.set(page);
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los lotes' });
        this.cargando.set(false);
      }
    });
  }

  loadProductos() {
    if (!this.activeCompanyId) return;
    this.productoService.listarActivos(this.activeCompanyId ?? undefined).subscribe({
      next: (res) => this.productos.set((res.data ?? []).filter(producto => producto.controlStock === 'LOTES')),
      error: () => {}
    });
  }

  onSearchChange(value: string) {
    this.searchQuery.set(value);
    this.searchTrigger.next();
  }

  onPageChange(event: any) {
    this.loadLotes(Number(event.page) || 0);
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

  openModal(item?: LoteResponse) {
    this.editingLote.set(item ?? null);
    this.loteForm.reset({
      productoId: item?.productoId ?? null,
      numeroLote: item?.numeroLote ?? '',
      fechaVencimiento: item?.fechaVencimiento ?? '',
      fechaIngreso: item?.fechaIngreso ?? '',
      cantidad: item?.cantidadInicial ?? 1,
      costoUnitario: item?.costoUnitario ?? null
    });
    this.showModal.set(true);
  }

  guardar() {
    if (this.loteForm.invalid) { this.loteForm.markAllAsTouched(); return; }
    const val = this.loteForm.value;
    const companyId = this.activeCompanyId;
    const payload = {
      ...val,
      fechaIngreso: val.fechaIngreso || null,
      costoUnitario: val.costoUnitario || null,
      ...(companyId ? { companyId } : {})
    };

    const editingItem = this.editingLote();
    const req = editingItem
      ? this.loteService.actualizar(editingItem.id, payload)
      : this.loteService.crear(payload);

    this.guardando.set(true);
    req.subscribe({
      next: () => {
        this.guardando.set(false);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editingItem ? 'Lote actualizado' : 'Lote creado' });
        this.showModal.set(false);
        this.loadLotes(editingItem ? this.lotesPage() : 0);
      },
      error: (err) => {
        this.guardando.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar el lote' });
      }
    });
  }

  openConfirm(title: string, message: string, action: string, item: LoteResponse, variant: 'primary' | 'warning' | 'danger', confirmLabel: string) {
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
    return 'bg-blue-50 text-blue-500';
  }

  confirmButtonClass(): string {
    const variant = this.confirmDialog()?.variant;
    const base = 'px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors';
    if (variant === 'danger') return `${base} bg-red-600 hover:bg-red-700`;
    if (variant === 'warning') return `${base} bg-amber-600 hover:bg-amber-700`;
    return `${base} bg-blue-500 hover:bg-blue-600`;
  }

  toggleActivo(item: LoteResponse) {
    this.loadingStore.show();
    this.loteService.toggleActivo(item.id).subscribe({
      next: () => {
        this.loadLotes(this.lotesPage());
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado del lote actualizado' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminar(id: number) {
    this.loadingStore.show();
    this.loteService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Lote eliminado correctamente' });
        this.loadLotes(this.lotesPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el lote' });
        this.loadingStore.hide();
      }
    });
  }
}
