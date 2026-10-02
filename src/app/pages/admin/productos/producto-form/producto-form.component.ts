import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ProductoService } from '../../../../core/services/producto.service';
import { CategoriaProductoService } from '../../../../core/services/categoria-producto.service';
import { UnidadMedidaService } from '../../../../core/services/unidad-medida.service';
import { MarcaProductoService } from '../../../../core/services/marca-producto.service';
import { LoteService } from '../../../../core/services/lote.service';
import { AjusteStockService } from '../../../../core/services/ajuste-stock.service';
import { MediaService } from '../../../../core/services/media.service';
import { CategoriaProductoResponse } from '../../../../models/response/categoria-producto-response';
import { UnidadMedidaResponse } from '../../../../models/response/unidad-medida-response';
import { MarcaProductoResponse } from '../../../../models/response/marca-producto-response';
import { LoteResponse } from '../../../../models/response/lote-response';
import { AjusteStockResponse } from '../../../../models/response/ajuste-stock-response';
import { AuthStore } from '../../../../store/auth.store';
import { noLeadingTrailingSpaceValidator } from '../../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../../core/validators/text-content.validator';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { ESPECIES_OPCIONES, EspecieMascota, TipoAplicacionProducto, TipoControlStock } from '../../../../models/request/producto-request';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ToastModule, SkeletonModule, HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './producto-form.component.html',
  styleUrl: './producto-form.component.scss'
})
export class ProductoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productoService = inject(ProductoService);
  private readonly categoriaProductoService = inject(CategoriaProductoService);
  private readonly unidadMedidaService = inject(UnidadMedidaService);
  private readonly marcaProductoService = inject(MarcaProductoService);
  private readonly loteService = inject(LoteService);
  private readonly ajusteStockService = inject(AjusteStockService);
  readonly mediaService = inject(MediaService);
  private readonly messageService = inject(MessageService);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  productoId: number | null = null;
  modoDetalle = false;
  productoSku = signal<string | null>(null);
  activeTab = signal<'datos' | 'lotes' | 'ajustes'>('datos');
  cargando = signal(true);
  guardando = signal(false);
  categorias = signal<CategoriaProductoResponse[]>([]);
  unidadesMedida = signal<UnidadMedidaResponse[]>([]);
  marcas = signal<MarcaProductoResponse[]>([]);
  marcaActual = signal<{ id: number; nombre: string } | null>(null);

  lotes = signal<LoteResponse[]>([]);
  cargandoLotes = signal(false);
  showLoteModal = signal(false);
  editingLote = signal<LoteResponse | null>(null);
  guardandoLote = signal(false);
  loteForm: FormGroup = this.fb.group({
    numeroLote: ['', [Validators.required, Validators.maxLength(60), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    fechaVencimiento: ['', Validators.required],
    fechaIngreso: [''],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    costoUnitario: [null, [Validators.min(0)]]
  });

  ajustesStock = signal<AjusteStockResponse[]>([]);
  showAjusteModal = signal(false);
  guardandoAjuste = signal(false);
  readonly motivosAjuste: { value: string; label: string }[] = [
    { value: 'CONTEO_FISICO', label: 'Conteo físico' },
    { value: 'MERMA', label: 'Merma' },
    { value: 'VENCIMIENTO', label: 'Vencimiento' },
    { value: 'DEVOLUCION', label: 'Devolución' },
    { value: 'CORRECCION', label: 'Corrección' },
    { value: 'OTRO', label: 'Otro' }
  ];
  ajusteForm: FormGroup = this.fb.group({
    stockNuevo: [0, [Validators.required, Validators.min(0)]],
    motivo: ['CONTEO_FISICO', Validators.required],
    observaciones: ['', [Validators.maxLength(300)]]
  });

  previewUrl     = signal<string | null>(null);
  photoError     = signal(false);
  selectedFile   = signal<File | null>(null);
  uploadingPhoto = signal(false);
  isDragging     = signal(false);

  readonly maxFileSize = 5 * 1024 * 1024; // 5 MB
  readonly allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  readonly allowedExtensions = ['.jpg', '.jpeg', '.jpe', '.png', '.webp'];

  productoForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: true })]],
    categoriaId: [null, Validators.required],
    precio:      [null, [Validators.required, Validators.min(0.1), Validators.max(5000)]],
    costo:       [null, [Validators.min(0), Validators.max(5000)]],
    marcaId:     [null, Validators.required],
    stock:       [0, [Validators.min(0)]],
    controlStock: ['DIRECTO' as TipoControlStock, Validators.required],
    stockMinimo: [0, [Validators.min(0)]],
    descripcion: ['', [Validators.maxLength(1000)]],
    imagenUrl:   [''],
    codigoBarras: ['', [Validators.maxLength(64), Validators.pattern(/^[A-Za-z0-9-]*$/)]],
    fechaVencimiento: [''],
    requiereReceta: [false],
    unidadMedidaId: [null],
    aplicacionEspecie: [null as TipoAplicacionProducto | null, Validators.required],
    especies: [[] as EspecieMascota[]]
  });

  readonly especiesOpciones = ESPECIES_OPCIONES;

  get esControlPorLotes(): boolean {
    return this.productoForm.get('controlStock')?.value === 'LOTES';
  }

  /** Clasificación pendiente: productos antiguos sin aplicacionEspecie no se pueden guardar. */
  get clasificacionPendiente(): boolean {
    return !this.productoForm.get('aplicacionEspecie')?.value;
  }

  /** Faltan especies cuando el producto es de especies específicas. */
  get especiesIncompletas(): boolean {
    return this.productoForm.get('aplicacionEspecie')?.value === 'ESPECIES_ESPECIFICAS'
      && (this.productoForm.get('especies')?.value?.length ?? 0) === 0;
  }

  tieneEspecie(especie: EspecieMascota): boolean {
    return (this.productoForm.get('especies')?.value ?? []).includes(especie);
  }

  toggleEspecie(especie: EspecieMascota, event: Event) {
    if (this.modoDetalle) return;
    const checked = (event.target as HTMLInputElement).checked;
    const actuales: EspecieMascota[] = [...(this.productoForm.get('especies')?.value ?? [])];
    const siguiente = checked
      ? [...actuales, especie]
      : actuales.filter(valor => valor !== especie);
    this.productoForm.get('especies')?.setValue(siguiente);
    this.productoForm.get('especies')?.markAsTouched();
  }

  ngOnInit() {
    const skuParam = this.route.snapshot.paramMap.get('sku');
    this.productoSku.set(skuParam);
    this.modoDetalle = this.route.snapshot.data['modo'] === 'detalle';

    // Al elegir "Uso general" no deben quedar especies seleccionadas.
    this.productoForm.get('aplicacionEspecie')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(valor => {
        if (valor !== 'ESPECIES_ESPECIFICAS') {
          this.productoForm.get('especies')?.setValue([], { emitEvent: false });
        }
      });

    this.productoForm.get('controlStock')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor: TipoControlStock) => {
        if (valor === 'LOTES') {
          this.productoForm.patchValue({ stock: 0, fechaVencimiento: '' }, { emitEvent: false });
        }
      });

    this.categoriaProductoService.listarActivas(this.activeCompanyId ?? undefined).subscribe({
      next: res => this.categorias.set(res.data ?? []),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las categorías' })
    });

    this.unidadMedidaService.listarActivas(this.activeCompanyId ?? undefined).subscribe({
      next: res => this.unidadesMedida.set(res.data ?? []),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las unidades de medida' })
    });

    this.marcaProductoService.listarActivas(this.activeCompanyId ?? undefined).subscribe({
      next: res => this.marcas.set(res.data ?? []),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las marcas de productos' })
    });

    if (skuParam) {
      this.productoService.obtener(skuParam, this.activeCompanyId ?? undefined).subscribe({
        next: res => {
          const item = res.data;
          if (item) {
            this.productoId = item.id;
            this.marcaActual.set(item.marcaId ? { id: item.marcaId, nombre: item.marca || 'Marca registrada' } : null);
            this.productoForm.patchValue({
              nombre: item.nombre,
              categoriaId: item.categoriaId,
              precio: item.precio,
              costo: item.costo ?? null,
              marcaId: item.marcaId ?? null,
              stock: item.stock,
              controlStock: item.controlStock ?? 'DIRECTO',
              stockMinimo: item.stockMinimo,
              descripcion: item.descripcion ?? '',
              imagenUrl: item.imagenUrl ?? '',
              codigoBarras: item.codigoBarras ?? '',
              fechaVencimiento: item.fechaVencimiento ?? '',
              requiereReceta: item.requiereReceta ?? false,
              unidadMedidaId: item.unidadMedidaId ?? null,
              aplicacionEspecie: item.aplicacionEspecie && item.aplicacionEspecie !== 'NO_ESPECIFICADO'
                ? item.aplicacionEspecie
                : null,
              especies: item.especies ?? []
            });
            this.previewUrl.set(this.mediaService.resolveUrl(item.imagenUrl));
            this.productoSku.set(item.sku || skuParam);
            if (this.modoDetalle) this.productoForm.disable({ emitEvent: false });
            if ((item.controlStock ?? 'DIRECTO') === 'LOTES') {
              this.cargarLotes();
              if (this.route.snapshot.queryParamMap.get('tab') === 'lotes') this.activeTab.set('lotes');
            } else {
              this.cargarAjustesStock();
            }
          }
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el producto' });
        }
      });
    } else {
      this.cargando.set(false);
    }
  }

  marcaActualEstaActiva(): boolean {
    const actual = this.marcaActual();
    return !!actual && this.marcas().some(marca => marca.id === actual.id);
  }

  private isValidFileType(file: File): boolean {
    return this.allowedTypes.includes(file.type) ||
           this.allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  private acceptFile(file: File): boolean {
    if (!this.isValidFileType(file)) {
      this.messageService.add({ severity: 'warn', summary: 'Formato no permitido', detail: 'Solo se permiten archivos JPG, PNG o WEBP' });
      return false;
    }
    if (file.size > this.maxFileSize) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo muy grande', detail: 'El tamaño máximo permitido es 5 MB' });
      return false;
    }
    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
    this.photoError.set(false);
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    return true;
  }

  onPhotoSelected(event: Event) {
    if (this.modoDetalle) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.acceptFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    if (this.modoDetalle) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    if (this.modoDetalle) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    if (this.modoDetalle) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.acceptFile(file);
  }

  onPhotoError() {
    this.photoError.set(true);
    this.previewUrl.set(null);
  }

  removePhoto() {
    if (this.modoDetalle) return;
    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
    this.selectedFile.set(null);
    this.productoForm.patchValue({ imagenUrl: '' });
    this.previewUrl.set(null);
  }

  guardar() {
    const permiso = this.productoId ? 'modificar' : 'escribir';
    if (this.modoDetalle || !this.authStore.hasAccess('VISTA_PRODUCTOS', permiso)) return;
    if (this.productoForm.invalid) { this.productoForm.markAllAsTouched(); return; }
    if (this.clasificacionPendiente) {
      this.productoForm.get('aplicacionEspecie')?.markAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Clasificación requerida', detail: 'Indica si el producto es de uso general o para especies específicas' });
      return;
    }
    if (this.especiesIncompletas) {
      this.productoForm.get('especies')?.markAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Especie requerida', detail: 'Selecciona al menos una especie para el producto' });
      return;
    }
    const companyId = this.activeCompanyId;

    const doSave = (imagenUrl?: string) => {
      const val = this.productoForm.value;
      const payload = {
        ...val,
        imagenUrl: imagenUrl ?? val.imagenUrl,
        stock: val.controlStock === 'LOTES' ? 0 : val.stock,
        fechaVencimiento: val.controlStock === 'LOTES' ? null : (val.fechaVencimiento || null),
        unidadMedidaId: val.unidadMedidaId || null,
        aplicacionEspecie: val.aplicacionEspecie as TipoAplicacionProducto,
        especies: val.aplicacionEspecie === 'ESPECIES_ESPECIFICAS' ? (val.especies ?? []) : [],
        ...(companyId ? { companyId } : {})
      };

      this.guardando.set(true);
      const sku = this.productoSku();
      const req = sku
        ? this.productoService.actualizar(sku, payload)
        : this.productoService.crear(payload);

      req.subscribe({
        next: (res) => {
          const creado = res.data;
          if (!this.productoId && val.controlStock === 'LOTES' && creado?.sku) {
            this.messageService.add({ severity: 'success', summary: 'Producto creado', detail: 'Ahora registra el primer lote recibido' });
            this.router.navigate(['/admin/productos', creado.sku, 'editar'], { queryParams: { tab: 'lotes' } });
            return;
          }
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.productoId ? 'Producto actualizado' : 'Producto creado' });
          this.router.navigate(['/admin/productos']);
        },
        error: (err) => {
          this.guardando.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        }
      });
    };

    const file = this.selectedFile();
    if (file) {
      this.uploadingPhoto.set(true);
      this.mediaService.upload(file).subscribe({
        next: (path) => {
          this.selectedFile.set(null);
          this.uploadingPhoto.set(false);
          doSave(path);
        },
        error: (err) => {
          this.uploadingPhoto.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo subir la imagen' });
        }
      });
    } else {
      doSave();
    }
  }

  cancelar() {
    this.router.navigate(['/admin/productos']);
  }

  editarDesdeDetalle() {
    const sku = this.productoSku();
    if (!sku || !this.authStore.hasAccess('VISTA_PRODUCTOS', 'modificar')) return;
    this.router.navigate(['/admin/productos', sku, 'editar']);
  }

  cargarLotes() {
    if (!this.productoId) return;
    this.cargandoLotes.set(true);
    this.loteService.listarPorProducto(this.productoId, 0, 100).subscribe({
      next: (res) => {
        this.lotes.set(res.data.content || []);
        this.cargandoLotes.set(false);
        const sku = this.productoSku();
        if (sku) {
          this.productoService.obtener(sku, this.activeCompanyId ?? undefined).subscribe({
            next: producto => this.productoForm.patchValue({ stock: producto.data?.stock ?? 0 }, { emitEvent: false }),
            error: () => {}
          });
        }
      },
      error: () => {
        this.cargandoLotes.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los lotes' });
      }
    });
  }

  openLoteModal(item?: LoteResponse) {
    const permiso = item ? 'modificar' : 'escribir';
    if (!this.authStore.hasAccess('VISTA_PRODUCTOS', permiso)) return;
    this.editingLote.set(item ?? null);
    this.loteForm.reset({
      numeroLote: item?.numeroLote ?? '',
      fechaVencimiento: item?.fechaVencimiento ?? '',
      fechaIngreso: item?.fechaIngreso ?? '',
      cantidad: item?.cantidadInicial ?? 1,
      costoUnitario: item?.costoUnitario ?? null
    });
    this.showLoteModal.set(true);
  }

  guardarLote() {
    if (this.guardandoLote()) return;
    if (this.loteForm.invalid || !this.productoId) { this.loteForm.markAllAsTouched(); return; }
    const val = this.loteForm.value;
    const companyId = this.activeCompanyId;
    const payload = {
      ...val,
      fechaIngreso: val.fechaIngreso || null,
      costoUnitario: val.costoUnitario || null,
      productoId: this.productoId,
      ...(companyId ? { companyId } : {})
    };

    const editingItem = this.editingLote();
    const req = editingItem
      ? this.loteService.actualizar(editingItem.id, payload)
      : this.loteService.crear(payload);

    this.guardandoLote.set(true);
    req.subscribe({
      next: () => {
        this.guardandoLote.set(false);
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editingItem ? 'Lote actualizado' : 'Lote creado' });
        this.showLoteModal.set(false);
        this.cargarLotes();
      },
      error: (err) => {
        this.guardandoLote.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar el lote' });
      }
    });
  }

  toggleActivoLote(item: LoteResponse) {
    if (!this.authStore.hasAccess('VISTA_PRODUCTOS', 'modificar')) return;
    this.loteService.toggleActivo(item.id).subscribe({
      next: () => {
        this.cargarLotes();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado del lote actualizado' });
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' })
    });
  }

  eliminarLote(item: LoteResponse) {
    if (!this.authStore.hasAccess('VISTA_PRODUCTOS', 'eliminar')) return;
    this.loteService.eliminar(item.id).subscribe({
      next: () => {
        this.cargarLotes();
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Lote eliminado correctamente' });
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el lote' })
    });
  }

  loteVencido(fecha: string): boolean {
    return new Date(fecha) < new Date(new Date().toDateString());
  }

  loteProntoAVencer(fecha: string): boolean {
    const dias = (new Date(fecha).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000;
    return dias >= 0 && dias <= 30;
  }

  cargarAjustesStock() {
    if (!this.productoId) return;
    this.ajusteStockService.listarPorProducto(this.productoId, 0, 20).subscribe({
      next: (res) => this.ajustesStock.set(res.data.content || []),
      error: () => {}
    });
  }

  openAjusteModal() {
    if (!this.authStore.hasAccess('VISTA_PRODUCTOS', 'modificar')) return;
    this.ajusteForm.reset({
      stockNuevo: this.productoForm.get('stock')?.value ?? 0,
      motivo: 'CONTEO_FISICO',
      observaciones: ''
    });
    this.showAjusteModal.set(true);
  }

  guardarAjuste() {
    if (!this.authStore.hasAccess('VISTA_PRODUCTOS', 'modificar')) return;
    if (this.ajusteForm.invalid || !this.productoId) { this.ajusteForm.markAllAsTouched(); return; }
    const val = this.ajusteForm.value;

    this.guardandoAjuste.set(true);
    this.ajusteStockService.ajustar({
      productoId: this.productoId,
      stockNuevo: val.stockNuevo,
      motivo: val.motivo,
      observaciones: val.observaciones || undefined
    }).subscribe({
      next: () => {
        this.guardandoAjuste.set(false);
        this.showAjusteModal.set(false);
        this.productoForm.patchValue({ stock: val.stockNuevo });
        this.cargarAjustesStock();
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Stock ajustado correctamente' });
      },
      error: (err) => {
        this.guardandoAjuste.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo ajustar el stock' });
      }
    });
  }

  motivoLabel(motivo: string): string {
    return this.motivosAjuste.find(m => m.value === motivo)?.label ?? motivo;
  }
}
