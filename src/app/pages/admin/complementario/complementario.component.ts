import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
import { MessageService } from 'primeng/api';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { TipoEmpleadoService } from '../../../core/services/tipo-empleado.service';
import { CompanyService } from '../../../core/services/company.service';
import { ServicioService } from '../../../core/services/servicio.service';
import { ServicioResponse } from '../../../models/response/servicio-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';


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

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }
  activeTab = signal<number>(0);

  especialidades = signal<any[]>([]);
  showEspModal = signal(false);
  editingEsp = signal<any | null>(null);
  espForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: ['']
  });
  tiposEmpleado = signal<any[]>([]);
  showTipoModal = signal(false);
  editingTipo = signal<any | null>(null);
  tipoForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    permiteEspecialidades: [false]
  });


  servicios           = signal<ServicioResponse[]>([]);
  showServicioModal   = signal(false);
  editingServicio     = signal<ServicioResponse | null>(null);
  servicioForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2)]],
    descripcion: ['', [Validators.required]],
    precio:      [null, [Validators.required, Validators.min(0.01)]],
    duracionEstimada: [20, [Validators.required, Validators.min(1)]],
    disponible:  [true],
    tipoEmpleadoId: [null]
  });
  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loadEspecialidades();
    this.loadTiposEmpleado();
    this.loadServicios();
  }

  loadEspecialidades() {
    const cid = this.activeCompanyId ?? undefined;
    this.especialidadService.listar(cid).subscribe({
      next: (res) => this.especialidades.set(res.data.content ?? res.data),
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
        this.loadEspecialidades();
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
        this.loadEspecialidades();
        this.loadingStore.hide();
      },
      error: () => { this.loadingStore.hide(); }
    });
  }
  loadTiposEmpleado() {
    const cid = this.activeCompanyId ?? undefined;
    this.tipoEmpleadoService.listar(cid).subscribe({
      next: (res) => this.tiposEmpleado.set(res.data.content ?? res.data),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los tipos de empleado' })
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
        this.loadTiposEmpleado();
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
        this.loadTiposEmpleado();
        this.loadingStore.hide();
      },
      error: () => this.loadingStore.hide()
    });
  }

  eliminarTipoEmpleado(id: number) {
    this.loadingStore.show();
    this.tipoEmpleadoService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Tipo de empleado eliminado' });
        this.loadTiposEmpleado();
        this.loadingStore.hide();
      },
      error: () => { this.loadingStore.hide(); }
    });
  }

  loadServicios() {
    const cid = this.activeCompanyId ?? undefined;
    this.servicioService.listar(cid, 0, 100).subscribe({
      next: (res) => {
        // Filter out soft-deleted services so they do not show up in the active list
        const activeList = (res.data.content || []).filter((s: ServicioResponse) => s.activo);
        this.servicios.set(activeList);
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
      tipoEmpleadoId: item?.tipoEmpleadoId ?? null
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
        this.loadServicios();
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
      next: () => { this.loadServicios(); this.loadingStore.hide(); },
      error: () => this.loadingStore.hide()
    });
  }

  eliminarServicio(id: number) {
    this.loadingStore.show();
    this.servicioService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Servicio eliminado correctamente' });
        this.loadServicios();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el servicio' });
        this.loadingStore.hide();
      }
    });
  }

}

