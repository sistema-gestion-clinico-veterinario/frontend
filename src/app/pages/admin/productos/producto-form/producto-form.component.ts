import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductoService } from '../../../../core/services/producto.service';
import { CategoriaProductoService } from '../../../../core/services/categoria-producto.service';
import { CategoriaProductoResponse } from '../../../../models/response/categoria-producto-response';
import { AuthStore } from '../../../../store/auth.store';
import { noLeadingTrailingSpaceValidator } from '../../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../../core/validators/text-content.validator';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ToastModule],
  providers: [MessageService],
  templateUrl: './producto-form.component.html'
})
export class ProductoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productoService = inject(ProductoService);
  private readonly categoriaProductoService = inject(CategoriaProductoService);
  private readonly messageService = inject(MessageService);
  private readonly authStore = inject(AuthStore);

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  productoId: number | null = null;
  cargando = signal(true);
  guardando = signal(false);
  categorias = signal<CategoriaProductoResponse[]>([]);

  productoForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: true })]],
    categoriaId: [null, Validators.required],
    precio:      [null, [Validators.required, Validators.min(0.1), Validators.max(5000)]],
    stock:       [0, [Validators.min(0)]],
    descripcion: ['', [Validators.maxLength(300)]],
    imagenUrl:   ['']
  });

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.productoId = idParam ? Number(idParam) : null;

    this.categoriaProductoService.listarActivas(this.activeCompanyId ?? undefined).subscribe({
      next: res => this.categorias.set(res.data ?? []),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las categorías' })
    });

    if (this.productoId) {
      this.productoService.listar(this.activeCompanyId ?? undefined, 0, 1000).subscribe({
        next: res => {
          const item = (res.data.content || []).find(p => p.id === this.productoId);
          if (item) {
            this.productoForm.patchValue({
              nombre: item.nombre,
              categoriaId: item.categoriaId,
              precio: item.precio,
              stock: item.stock,
              descripcion: item.descripcion ?? '',
              imagenUrl: item.imagenUrl ?? ''
            });
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

  guardar() {
    if (this.productoForm.invalid) { this.productoForm.markAllAsTouched(); return; }
    const val = this.productoForm.value;
    const companyId = this.activeCompanyId;
    const payload = { ...val, ...(companyId ? { companyId } : {}) };

    this.guardando.set(true);
    const req = this.productoId
      ? this.productoService.actualizar(this.productoId, payload)
      : this.productoService.crear(payload);

    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.productoId ? 'Producto actualizado' : 'Producto creado' });
        this.router.navigate(['/admin/productos']);
      },
      error: (err) => {
        this.guardando.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
      }
    });
  }

  cancelar() {
    this.router.navigate(['/admin/productos']);
  }
}
