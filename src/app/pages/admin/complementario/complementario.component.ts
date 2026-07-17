import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextarea } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { TipoEmpleadoService } from '../../../core/services/tipo-empleado.service';
import { CompanyService } from '../../../core/services/company.service';
import { ServicioService } from '../../../core/services/servicio.service';
import { ServicioResponse } from '../../../models/response/servicio-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { lettersOnlyValidator } from '../../../core/validators/letters-only.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';


@Component({
  selector: 'app-complementario',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TabViewModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    ToastModule,
    CheckboxModule,
    MultiSelectModule,
    PaginatorModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './complementario.component.html',
  styleUrl: './complementario.component.scss'
})
export class ComplementarioComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly especialidadService = inject(EspecialidadService);
  private readonly tipoEmpleadoService = inject(TipoEmpleadoService);
  private readonly companyService = inject(CompanyService);
  private readonly servicioService = inject(ServicioService);
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
      this.resetPagination();

      if (!companyId) {
        this.clearData();
        return;
      }

      this.loadAll();
    });
  }
  activeTab = signal<number>(0);
  confirmDialog = signal<{
    title: string;
    message: string;
    action: string;
    item: any;
    variant: 'primary' | 'warning' | 'danger';
    confirmLabel: string;
  } | null>(null);

  openConfirm(
    title: string,
    message: string,
    action: string,
    item: any,
    variant?: 'primary' | 'warning' | 'danger',
    confirmLabel?: string
  ) {
    const resolvedVariant = variant ?? (action.includes('eliminar') ? 'danger' : action.includes('estado') || action.includes('toggle') ? 'warning' : 'primary');
    const resolvedLabel = confirmLabel ?? (resolvedVariant === 'danger' ? 'Eliminar' : 'Confirmar');
    this.confirmDialog.set({ title, message, action, item, variant: resolvedVariant, confirmLabel: resolvedLabel });
  }

  cancelConfirm() {
    this.confirmDialog.set(null);
  }

  confirmAction() {
    const ctx = this.confirmDialog();
    if (!ctx) return;
    this.cancelConfirm();
    switch (ctx.action) {
      case 'guardar-especialidad': this.saveEspecialidad(); break;
      case 'eliminar-especialidad': this.eliminarEspecialidad(ctx.item.id); break;
      case 'guardar-tipo-empleado': this.saveTipoEmpleado(); break;
      case 'eliminar-tipo-empleado': this.eliminarTipoEmpleado(ctx.item.id); break;
      case 'cambiar-estado-tipo': this.cambiarEstadoTipo(ctx.item); break;
      case 'guardar-servicio': this.saveServicio(); break;
      case 'eliminar-servicio': this.eliminarServicio(ctx.item.id); break;
      case 'toggle-servicio': this.toggleServicioDisponible(ctx.item); break;
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

  confirmarGuardarEspecialidad() {
    if (this.espForm.invalid) { this.espForm.markAllAsTouched(); return; }
    const nombre = this.espForm.get('nombre')?.value?.trim();
    const editando = this.editingEsp();
    this.openConfirm(
      editando ? 'Actualizar especialidad' : 'Crear especialidad',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' la especialidad «' + nombre + '»?',
      'guardar-especialidad',
      null
    );
  }

  confirmarGuardarTipoEmpleado() {
    if (this.tipoForm.invalid) { this.tipoForm.markAllAsTouched(); return; }
    const nombre = this.tipoForm.get('nombre')?.value?.trim();
    const editando = this.editingTipo();
    this.openConfirm(
      editando ? 'Actualizar tipo de empleado' : 'Crear tipo de empleado',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' el tipo de empleado «' + nombre + '»?',
      'guardar-tipo-empleado',
      null,
      'primary',
      editando ? 'Actualizar' : 'Crear'
    );
  }

  confirmarCambiarEstadoTipo(item: any) {
    const nuevoEstado = !item.estado;
    this.openConfirm(
      nuevoEstado ? 'Activar tipo de empleado' : 'Desactivar tipo de empleado',
      'El tipo de empleado "' + item.nombre + '" quedara ' + (nuevoEstado ? 'activo' : 'inactivo') + '.',
      'cambiar-estado-tipo',
      item,
      'warning',
      nuevoEstado ? 'Activar' : 'Desactivar'
    );
  }

  confirmarEliminarTipoEmpleado(item: any) {
    this.openConfirm(
      'Eliminar tipo de empleado',
      'Se eliminara el tipo de empleado "' + item.nombre + '". Esta accion no se puede deshacer.',
      'eliminar-tipo-empleado',
      item,
      'danger',
      'Eliminar'
    );
  }

  confirmarGuardarServicio() {
    if (this.servicioForm.invalid) { this.servicioForm.markAllAsTouched(); return; }
    const nombre = this.servicioForm.get('nombre')?.value?.trim();
    const editando = this.editingServicio();
    this.openConfirm(
      editando ? 'Actualizar servicio' : 'Crear servicio',
      '¿Está seguro de ' + (editando ? 'actualizar' : 'crear') + ' el servicio «' + nombre + '»?',
      'guardar-servicio',
      null
    );
  }

  especialidades = signal<any[]>([]);
  especialidadesTotal = signal(0);
  especialidadesPage = signal(0);
  showEspModal = signal(false);
  editingEsp = signal<any | null>(null);
  espForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noLeadingTrailingSpaceValidator(), lettersOnlyValidator()]],
    descripcion: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]]
  });
  tiposEmpleado = signal<any[]>([]);
  tiposEmpleadoCatalogo = signal<any[]>([]);
  tiposEmpleadoTotal = signal(0);
  tiposEmpleadoPage = signal(0);
  tiposEmpleadoActivos = computed(() => this.tiposEmpleadoCatalogo().filter(t => t.estado !== false));
  showTipoModal = signal(false);
  editingTipo = signal<any | null>(null);
  tipoForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), noLeadingTrailingSpaceValidator(), lettersOnlyValidator()]],
    descripcion: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    permiteEspecialidades: [false]
  });


  servicios           = signal<ServicioResponse[]>([]);
  serviciosTotal      = signal(0);
  serviciosPage       = signal(0);
  readonly pageSize   = 8;
  showServicioModal   = signal(false);
  editingServicio     = signal<ServicioResponse | null>(null);
  servicioForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), noLeadingTrailingSpaceValidator(), lettersOnlyValidator()]],
    descripcion: ['', [Validators.required, Validators.maxLength(300), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    precio:      [null, [Validators.required, Validators.min(5), Validators.max(5000)]],
    duracionEstimada: [20, [Validators.required, Validators.min(5), Validators.max(240)]],
    disponible:  [true],
    tipoEmpleadoId: [null],
    tipoControlPreventivo: ['NO_APLICA']
  });
  ngOnInit() {
  }

  loadAll() {
    if (!this.activeCompanyId) {
      this.clearData();
      return;
    }

    this.loadEspecialidades();
    this.loadTiposEmpleado();
    this.loadTiposEmpleadoCatalogo();
    this.loadServicios();
  }

  private resetPagination() {
    this.especialidadesPage.set(0);
    this.tiposEmpleadoPage.set(0);
    this.serviciosPage.set(0);
  }

  private clearData() {
    this.especialidades.set([]);
    this.especialidadesTotal.set(0);
    this.tiposEmpleado.set([]);
    this.tiposEmpleadoCatalogo.set([]);
    this.tiposEmpleadoTotal.set(0);
    this.servicios.set([]);
    this.serviciosTotal.set(0);
  }

  private pageTotal(data: any): number {
    return data?.page?.totalElements ?? data?.totalElements ?? 0;
  }

  loadEspecialidades(page = this.especialidadesPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.especialidadService.listar(cid, page, this.pageSize).subscribe({
      next: (res) => {
        this.especialidades.set(res.data.content ?? res.data);
        this.especialidadesTotal.set(this.pageTotal(res.data));
        this.especialidadesPage.set(page);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las especialidades' })
    });
  }

  openEspModal(item?: any) {
    this.editingEsp.set(item ?? null);
    this.espForm.reset({ nombre: item?.nombre ?? '', descripcion: item?.descripcion ?? '' });
    this.showEspModal.set(true);
  }

  saveEspecialidad() {
    if (this.espForm.invalid) { this.espForm.markAllAsTouched(); return; }
    const val = this.espForm.value;
    const companyId = this.activeCompanyId;
    const payload = {
      ...val,
      ...(companyId && !this.editingEsp() ? { company: { id: companyId } } : {})
    };

    const req = this.editingEsp()
      ? this.especialidadService.actualizar(this.editingEsp().id, payload)
      : this.especialidadService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.editingEsp() ? 'Especialidad actualizada' : 'Especialidad creada' });
        this.showEspModal.set(false);
        this.loadEspecialidades(this.editingEsp() ? this.especialidadesPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarEspecialidad(id: number) {
    this.loadingStore.show();
    this.especialidadService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminada', detail: 'Especialidad eliminada' });
        this.loadEspecialidades(this.especialidadesPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la especialidad' });
        this.loadingStore.hide();
      }
    });
  }
  loadTiposEmpleado(page = this.tiposEmpleadoPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.tipoEmpleadoService.listar(cid, page, this.pageSize).subscribe({
      next: (res) => {
        this.tiposEmpleado.set(res.data.content ?? res.data);
        this.tiposEmpleadoTotal.set(this.pageTotal(res.data));
        this.tiposEmpleadoPage.set(page);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los tipos de empleado' })
    });
  }

  loadTiposEmpleadoCatalogo() {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.tipoEmpleadoService.listar(cid, 0, 100).subscribe({
      next: (res) => this.tiposEmpleadoCatalogo.set(res.data.content ?? res.data),
      error: () => this.tiposEmpleadoCatalogo.set([])
    });
  }

  openTipoModal(item?: any) {
    this.editingTipo.set(item ?? null);
    this.tipoForm.reset({
      nombre: item?.nombre ?? '',
      descripcion: item?.descripcion ?? '',
      permiteEspecialidades: item?.permiteEspecialidades ?? false
    });
    this.showTipoModal.set(true);
  }

  saveTipoEmpleado() {
    if (this.tipoForm.invalid) { this.tipoForm.markAllAsTouched(); return; }
    const val = this.tipoForm.value;
    const companyId = this.activeCompanyId;
    const payload = {
      ...val,
      ...(companyId ? { company: { id: companyId } } : {})
    };

    const editing = this.editingTipo();
    const req = editing
      ? this.tipoEmpleadoService.actualizar(editing.id, payload)
      : this.tipoEmpleadoService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editing ? 'Tipo de empleado actualizado' : 'Tipo de empleado creado' });
        this.showTipoModal.set(false);
        this.loadTiposEmpleado(editing ? this.tiposEmpleadoPage() : 0);
        this.loadTiposEmpleadoCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  cambiarEstadoTipo(item: any) {
    this.loadingStore.show();
    this.tipoEmpleadoService.cambiarEstado(item.id, !item.estado).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado' });
        this.loadTiposEmpleado(this.tiposEmpleadoPage());
        this.loadTiposEmpleadoCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarTipoEmpleado(id: number) {
    this.loadingStore.show();
    this.tipoEmpleadoService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Tipo de empleado eliminado' });
        this.loadTiposEmpleado(this.tiposEmpleadoPage());
        this.loadTiposEmpleadoCatalogo();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el tipo de empleado' });
        this.loadingStore.hide();
      }
    });
  }

  loadServicios(page = this.serviciosPage()) {
    if (!this.activeCompanyId) return;
    const cid = this.activeCompanyId ?? undefined;
    this.servicioService.listar(cid, page, this.pageSize).subscribe({
      next: (res) => {
        // Filter out soft-deleted services so they do not show up in the active list
        const activeList = (res.data.content || []).filter((s: ServicioResponse) => s.activo);
        this.servicios.set(activeList);
        this.serviciosTotal.set(this.pageTotal(res.data));
        this.serviciosPage.set(page);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los servicios' })
    });
  }

  openServicioModal(item?: ServicioResponse) {
    this.editingServicio.set(item ?? null);
    this.servicioForm.reset({
      nombre:      item?.nombre      ?? '',
      descripcion: item?.descripcion ?? '',
      precio:      item?.precio      ?? null,
      duracionEstimada: item?.duracionEstimada ?? 20,
      disponible:  item?.disponible  ?? true,
      tipoEmpleadoId: item?.tipoEmpleadoId ?? null,
      tipoControlPreventivo: item?.tipoControlPreventivo ?? 'NO_APLICA'
    });
    this.showServicioModal.set(true);
  }

  saveServicio() {
    if (this.servicioForm.invalid) { this.servicioForm.markAllAsTouched(); return; }
    const val = this.servicioForm.value;
    const companyId = this.activeCompanyId;
    const payload = { ...val, ...(companyId ? { companyId } : {}) };

    const editing = this.editingServicio();
    const req = editing
      ? this.servicioService.actualizar(editing.id, payload)
      : this.servicioService.crear(payload);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: editing ? 'Servicio actualizado' : 'Servicio creado' });
        this.showServicioModal.set(false);
        this.loadServicios(editing ? this.serviciosPage() : 0);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  toggleServicioDisponible(item: ServicioResponse) {
    this.loadingStore.show();
    this.servicioService.toggleDisponible(item.id).subscribe({
      next: () => {
        this.loadServicios(this.serviciosPage());
        this.loadingStore.hide();
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Disponibilidad del servicio actualizada' });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar la disponibilidad' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarServicio(id: number) {
    this.loadingStore.show();
    this.servicioService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Servicio eliminado correctamente' });
        this.loadServicios(this.serviciosPage());
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el servicio' });
        this.loadingStore.hide();
      }
    });
  }

  onEspecialidadesPageChange(event: any) {
    this.loadEspecialidades(Number(event.page) || 0);
  }

  onTiposEmpleadoPageChange(event: any) {
    this.loadTiposEmpleado(Number(event.page) || 0);
  }

  onServiciosPageChange(event: any) {
    this.loadServicios(Number(event.page) || 0);
  }

}

