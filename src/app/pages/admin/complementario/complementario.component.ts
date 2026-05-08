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
import { RoleService } from '../../../core/services/role.service';
import { CompanyService } from '../../../core/services/company.service';
import { ServicioService } from '../../../core/services/servicio.service';
import { ServicioResponse } from '../../../models/response/servicio-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';

interface Permission {
  id: number;
  name: string;
}

interface RoleItem {
  id: number;
  name: string;
  permissions: Permission[];
}

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
    MultiSelectModule
  ],
  providers: [MessageService],
  templateUrl: './complementario.component.html'
})
export class ComplementarioComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly especialidadService = inject(EspecialidadService);
  private readonly tipoEmpleadoService = inject(TipoEmpleadoService);
  private readonly roleService = inject(RoleService);
  private readonly companyService = inject(CompanyService);
  private readonly servicioService = inject(ServicioService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  readonly isSuperAdmin = this.authStore.roles().includes(Role.SUPER_ADMIN);

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  // Tabs
  activeTab = signal<number>(0);

  // Especialidades
  especialidades = signal<any[]>([]);
  showEspModal = signal(false);
  editingEsp = signal<any | null>(null);
  espForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: ['']
  });

  // Tipos de Empleado
  tiposEmpleado = signal<any[]>([]);
  showTipoModal = signal(false);
  editingTipo = signal<any | null>(null);
  tipoForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    permiteEspecialidades: [false]
  });

  // Servicios veterinarios
  servicios           = signal<ServicioResponse[]>([]);
  showServicioModal   = signal(false);
  editingServicio     = signal<ServicioResponse | null>(null);
  servicioForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2)]],
    descripcion: ['', [Validators.required]],
    precio:      [null, [Validators.required, Validators.min(0.01)]],
    duracionEstimada: [20, [Validators.required, Validators.min(1)]],
    disponible:  [true]
  });

  // Roles
  roles = signal<RoleItem[]>([]);
  permisos = signal<Permission[]>([]);
  permisosOptions = signal<{ label: string; value: number }[]>([]);
  
  permissionSearch = signal<string>('');
  
  filteredPermisos = computed(() => {
    const search = this.permissionSearch().toLowerCase();
    return this.permisosOptions().filter(p => p.label.toLowerCase().includes(search));
  });

  groupedPermisos = computed(() => {
    const filtered = this.filteredPermisos();
    const groups: { [key: string]: any[] } = {};
    
    filtered.forEach((p: { label: string; value: number }) => {
      const parts = p.label.split('_');
      const category = parts.length > 1 ? parts[0] : 'OTROS';
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });

    return Object.keys(groups).sort().map(key => ({
      name: key,
      items: groups[key]
    }));
  });
  showRolModal = signal(false);
  editingRol = signal<RoleItem | null>(null);
  rolForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    permissionIds: [[]]
  });

  ngOnInit() {
    this.loadAll();
    this.loadRoles();
    this.loadPermisos();
  }

  isPermissionSelected(id: number): boolean {
    const current = this.rolForm.get('permissionIds')?.value || [];
    return current.includes(id);
  }

  togglePermission(id: number) {
    const control = this.rolForm.get('permissionIds');
    const current = control?.value || [];
    if (current.includes(id)) {
      control?.setValue(current.filter((i: number) => i !== id));
    } else {
      control?.setValue([...current, id]);
    }
  }

  selectAllPermissions() {
    this.rolForm.get('permissionIds')?.setValue(this.permisosOptions().map(p => p.value));
  }

  deselectAllPermissions() {
    this.rolForm.get('permissionIds')?.setValue([]);
  }

  loadAll() {
    this.loadEspecialidades();
    this.loadTiposEmpleado();
    this.loadRoles();
    this.loadServicios();
  }

  // ─── ESPECIALIDADES ───────────────────────────────────────
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

  // ─── TIPOS DE EMPLEADO ────────────────────────────────────
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

    this.loadingStore.show();
    this.tipoEmpleadoService.crear(payload).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Tipo de empleado creado' });
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

  // ─── SERVICIOS VETERINARIOS ───────────────────────────────
  loadServicios() {
    const cid = this.activeCompanyId ?? undefined;
    this.servicioService.listar(cid, 0, 100).subscribe({
      next: (res) => this.servicios.set(res.data.content),
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
      disponible:  item?.disponible  ?? true
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
        this.messageService.add({ severity: 'success', summary: 'Desactivado', detail: 'Servicio desactivado correctamente' });
        this.loadServicios();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo desactivar' });
        this.loadingStore.hide();
      }
    });
  }

  // ─── ROLES ────────────────────────────────────────────────
  loadRoles() {
    this.roleService.listar().subscribe({
      next: (res) => this.roles.set((res.data ?? []) as RoleItem[]),
      error: () => {}
    });
  }

  loadPermisos() {
    this.roleService.listarPermisos().subscribe({
      next: (res) => {
        this.permisos.set((res.data ?? []) as Permission[]);
        this.permisosOptions.set(((res.data ?? []) as Permission[]).map(p => ({ label: p.name, value: p.id })));
      }
    });
  }

  openRolModal(item?: any) {
    this.editingRol.set(item ?? null);
    this.rolForm.reset({
      name: item?.name ?? '',
      permissionIds: item?.permissions?.map((p: any) => p.id) ?? []
    });
    this.showRolModal.set(true);
  }

  saveRol() {
    if (this.rolForm.invalid) { this.rolForm.markAllAsTouched(); return; }
    const val = this.rolForm.value;
    const currentRole = this.editingRol();
    const req = currentRole
      ? this.roleService.actualizar(currentRole.id!, val)
      : this.roleService.crear(val);

    this.loadingStore.show();
    req.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.editingRol() ? 'Rol actualizado' : 'Rol creado' });
        this.showRolModal.set(false);
        this.loadRoles();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  eliminarRol(id: number) {
    this.loadingStore.show();
    this.roleService.eliminar(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Rol eliminado' });
        this.loadRoles();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se puede eliminar este rol' });
        this.loadingStore.hide();
      }
    });
  }
}
