import { Component, OnInit, OnDestroy, inject, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MenuModule } from 'primeng/menu';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuItem, MessageService } from 'primeng/api';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { MediaService } from '../../../core/services/media.service';
import { CompanyService } from '../../../core/services/company.service';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { TipoEmpleadoService } from '../../../core/services/tipo-empleado.service';
import { RoleService } from '../../../core/services/role.service';
import { EmpleadoListResponse } from '../../../models/response/empleado-list-response';
import { EmpleadoRequest, HorarioEmpleadoRequest } from '../../../models/request/empleado-request';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { InputFilterDirective } from '../../../core/directives/input-filter.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { normalizeText } from '../../../core/utils/normalize-text.util';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    MultiSelectModule,
    ToastModule,
    MenuModule,
    SkeletonModule,
    HasPermissionDirective,
    InputFilterDirective
  ],
  providers: [MessageService],
  templateUrl: './employee.component.html'
})
export class EmployeeComponent implements OnInit, OnDestroy {
  private readonly employeeActionItemsCache = new WeakMap<EmpleadoListResponse, MenuItem[]>();
  private readonly fb = inject(FormBuilder);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly mediaService = inject(MediaService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  private readonly especialidadService = inject(EspecialidadService);
  private readonly tipoEmpleadoService = inject(TipoEmpleadoService);
  private readonly roleService = inject(RoleService);
  readonly authStore = inject(AuthStore);

  @ViewChild('empFileInput') empFileInput!: ElementRef<HTMLInputElement>;

  uploadingPhoto = signal(false);
  photoPreview = signal<string | null>(null);
  selectedFile = signal<File | null>(null);

  confirmDialog = signal<{ title: string; message: string; onConfirm: () => void } | null>(null);

  employees = signal<EmpleadoListResponse[]>([]);
  cargando = signal<boolean>(true);
  displayModal = signal<boolean>(false);
  isEdit = signal<boolean>(false);
  showPasswordResetModal = signal<boolean>(false);
  selectedEmployeeForReset = signal<EmpleadoListResponse | null>(null);
  requestingPasswordReset = signal<boolean>(false);
  especialidadesList = signal<any[]>([]);
  tiposEmpleadoList = signal<any[]>([]);
  totalRecords = signal<number>(0);
  openDropdown = signal<string | null>(null);
  searchFilter = signal<string>('');
  displayDetailModal = signal<boolean>(false);
  selectedEmployeeDetail = signal<EmpleadoRequest | null>(null);

  public toggleDropdown(name: string, event?: Event) {
    if (event) event.stopPropagation();
    if (this.openDropdown() === name) {
      this.openDropdown.set(null);
    } else {
      this.openDropdown.set(name);
      this.searchFilter.set('');
    }
  }

  onDocInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const tipo = this.employeeForm.get('tipoDocumento')?.value;
    const raw = input.value;
    let filtered = '';
    if (tipo === 'DNI' || tipo === 'CARNET_EXTRANJERIA') {
      filtered = raw.replace(/\D/g, '');
    } else if (tipo === 'PASAPORTE') {
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (i === 0 && /[A-Za-z]/.test(ch)) {
          filtered += ch.toUpperCase();
        } else if (i > 0 && /\d/.test(ch)) {
          filtered += ch;
        }
      }
    }
    if (input.value !== filtered) {
      input.value = filtered;
      this.employeeForm.get('numeroDocumento')?.setValue(filtered, { emitEvent: false });
    }
  }

  public getFilteredOptions(list: any[]): any[] {
    if (!this.searchFilter()) return list;
    const filter = this.searchFilter().toLowerCase();
    return list.filter(item => item.label.toLowerCase().includes(filter));
  }

  public toggleSelection(controlName: string, value: any) {
    const control = this.employeeForm.get(controlName);
    if (!control) return;
    const currentValues = [...(control.value || [])];
    const index = currentValues.indexOf(value);
    if (index > -1) {
      currentValues.splice(index, 1);
    } else {
      currentValues.push(value);
    }
    control.setValue(currentValues);
    control.markAsTouched();
  }

  public isSelected(controlName: string, value: any): boolean {
    return this.employeeForm.get(controlName)?.value?.includes(value) ?? false;
  }

  resolvePhotoUrl(path: string | null | undefined): string | null {
    return this.mediaService.resolveUrl(path);
  }

  openConfirm(title: string, message: string, onConfirm: () => void) {
    this.confirmDialog.set({ title, message, onConfirm });
  }

  confirmAction() {
    this.confirmDialog()?.onConfirm();
    this.confirmDialog.set(null);
  }

  cancelConfirm() {
    this.confirmDialog.set(null);
  }

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  roles = signal<{ label: string; value: number }[]>([]);

  tipoDocumentos = [
    { label: 'DNI', value: 'DNI' },
    { label: 'Pasaporte', value: 'PASAPORTE' },
    { label: 'Carnet de Extranjería', value: 'CARNET_EXTRANJERIA' }
  ];

  generos = [
    { label: 'Masculino', value: 'MASCULINO' },
    { label: 'Femenino', value: 'FEMENINO' }
  ];

  readonly diasSemana = [
    { key: 'LUNES', label: 'Lunes' },
    { key: 'MARTES', label: 'Martes' },
    { key: 'MIERCOLES', label: 'Miércoles' },
    { key: 'JUEVES', label: 'Jueves' },
    { key: 'VIERNES', label: 'Viernes' },
    { key: 'SABADO', label: 'Sábado' },
    { key: 'DOMINGO', label: 'Domingo' },
  ];

  horarios: { diaSemana: string; activo: boolean; horaInicio: string; horaFin: string }[] =
    this.diasSemana.map((d, i) => ({ diaSemana: d.key, activo: false, horaInicio: i % 2 === 0 ? '08:00' : '13:00', horaFin: i % 2 === 0 ? '13:00' : '18:00' }));


  employeeForm: FormGroup = this.fb.group({
    id: [null],
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), Validators.maxLength(100)]],
    numeroDocumento: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    tipoDocumento: ['DNI', [Validators.required]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    direccion: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s\.,#\-\/°:]+$/), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    roleIds: [[], [(c: AbstractControl) => c.value?.length ? null : { required: true }]],
    companyId: [null],
    genero: ['MASCULINO', [Validators.required]],
    observaciones: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    fotoUrl: ['', [Validators.maxLength(500), Validators.pattern(/^$|^https?:\/\/[^\s<>]+$/)]],
    numeroColegiatura: ['', [Validators.maxLength(30), noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: false })]],
    especialidades: [[]],
    tiposEmpleado: [[]]
  });

  ngOnInit() {
    const companyId = this.activeCompanyId;
    if (companyId) {
      this.loadEspecialidades(companyId);
      this.loadTypesEmpleado(companyId);
      this.loadRoles(companyId);
      this.employeeForm.get('companyId')?.setValue(companyId);
    }

    this.employeeForm.get('tiposEmpleado')?.valueChanges.subscribe(types => {
      const isVet = types?.some((type: string) => type.toUpperCase() === 'VETERINARIO');
      const collegiatura = this.employeeForm.get('numeroColegiatura');
      const commonValidators = [noLeadingTrailingSpaceValidator(), textContentValidator({ requireLetter: false })];
      if (isVet) {
        collegiatura?.setValidators([
          Validators.required,
          Validators.maxLength(15),
          Validators.pattern(/^[^.,]+$/),
          ...commonValidators
        ]);
      } else {
        collegiatura?.setValidators([
          Validators.maxLength(30),
          ...commonValidators
        ]);
      }
      collegiatura?.updateValueAndValidity();
    });

    this.employeeForm.get('tipoDocumento')?.valueChanges.subscribe(tipo => {
      const doc = this.employeeForm.get('numeroDocumento');
      if (tipo === 'DNI') {
        doc?.setValidators([Validators.required, Validators.pattern(/^\d{8}$/)]);
      } else if (tipo === 'PASAPORTE') {
        doc?.setValidators([Validators.required, Validators.pattern(/^[a-zA-Z]\d{8}$/)]);
      } else {
        doc?.setValidators([Validators.required, Validators.pattern(/^\d{9}$/)]);
      }
      if (!this.isEdit()) {
        doc?.reset('');
      }
      doc?.updateValueAndValidity();
    });

    this.employeeForm.get('companyId')?.valueChanges.subscribe(companyId => {
      if (!companyId) {
        this.especialidadesList.set([]);
        this.tiposEmpleadoList.set([]);
        this.roles.set([]);
        return;
      }
      this.loadEspecialidades(companyId);
      this.loadTypesEmpleado(companyId);
      this.loadRoles(companyId);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.openDropdown()) {
      this.openDropdown.set(null);
    }
  }

  get documentoErrorMsg(): string {
    const tipo = this.employeeForm.get('tipoDocumento')?.value;
    if (tipo === 'PASAPORTE') return 'El pasaporte debe comenzar con una letra seguida de 8 números (ej: A12345678)';
    if (tipo === 'CARNET_EXTRANJERIA') return 'El carnet de extranjería debe tener exactamente 9 dígitos';
    return 'El DNI debe tener exactamente 8 dígitos';
  }

  loadEmployees(event: any = { first: 0, rows: 10 }) {
    const companyId = this.activeCompanyId ?? undefined;
    if (!companyId) return;

    const isFirstLoad = this.employees().length === 0;
    if (isFirstLoad) this.cargando.set(true);
    const page = event.first / event.rows;

    this.empleadoService.listar(companyId, undefined, page, event.rows).subscribe({
      next: (res) => {
        this.employees.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los empleados' });
        this.cargando.set(false);
      }
    });
  }


  loadEspecialidades(companyId?: number) {
    this.especialidadService.listar(companyId).subscribe({
      next: (res) => {
        const list = res.data.content.map(e => ({ label: e.nombre, value: e.nombre }));
        this.especialidadesList.set(list);
      }
    });
  }

  loadTypesEmpleado(companyId?: number) {
    this.tipoEmpleadoService.listar(companyId).subscribe({
      next: (res) => {
        const list = (res.data.content || [])
          .filter(t => t.estado !== false)
          .map(t => ({ label: t.nombre, value: t.nombre }));
        this.tiposEmpleadoList.set(list);
      }
    });
  }

  loadRoles(companyId?: number) {
    const id = companyId || this.activeCompanyId;
    if (!id) {
      this.roles.set([]);
      return;
    }
    this.roleService.listarRolesPersonalAsignables(id).subscribe({
      next: ({ data }) => {
        const list = (data ?? [])
          .filter(role => role.activo && role.scope === 'STAFF')
          .map(r => ({
            label: this.roleLabel(r.name),
            value: r.id
          }));
        this.roles.set(list);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los roles' });
      }
    });
  }

  roleLabel(name: string): string {
    return name.replace(/^ROLE_/, '').replaceAll('_', ' ');
  }

  canEmployeeAction(tipo: 'leer' | 'modificar' | 'eliminar'): boolean {
    return this.authStore.hasAccess('VISTA_EMPLEADOS', tipo);
  }

  viewEmployeeDetail(employee: EmpleadoListResponse) {
    this.empleadoService.getById(employee.id).subscribe({
      next: (res) => {
        this.selectedEmployeeDetail.set(res.data);
        this.displayDetailModal.set(true);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información del empleado' });
      }
    });
  }

  employeeActionItems(employee: EmpleadoListResponse): MenuItem[] {
    const cached = this.employeeActionItemsCache.get(employee);
    if (cached) return cached;

    const items: MenuItem[] = [];

    if (this.canEmployeeAction('leer')) {
      items.push({
        label: 'Ver Detalles',
        icon: 'pi pi-eye',
        command: () => this.viewEmployeeDetail(employee)
      });
    }

    items.push({
      label: 'Restablecer contraseña',
      icon: 'pi pi-lock',
      disabled: !employee.activo,
      command: () => this.openPasswordResetModal(employee)
    });

    if (this.canEmployeeAction('modificar')) {
      items.push({
        label: 'Editar',
        icon: 'pi pi-pencil',
        disabled: !employee.activo,
        command: () => this.editEmployee(employee)
      });
    }

    if (this.canEmployeeAction('eliminar')) {
      items.push({
        label: 'Eliminar',
        icon: 'pi pi-trash',
        command: () => this.deleteEmployee(employee)
      });
    }

    this.employeeActionItemsCache.set(employee, items);
    return items;
  }

  triggerPhotoInput() {
    this.empFileInput.nativeElement.click();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.messageService.add({ severity: 'warn', summary: 'Formato no válido', detail: 'Solo JPG, PNG o WEBP' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo muy grande', detail: 'Máximo 5 MB' });
      return;
    }

    if (this.photoPreview() && this.photoPreview()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreview()!);
    }
    this.selectedFile.set(file);
    this.photoPreview.set(URL.createObjectURL(file));
    input.value = '';
  }

  ngOnDestroy() {
    if (this.photoPreview() && this.photoPreview()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreview()!);
    }
  }

  openNew() {
    this.selectedFile.set(null);
    this.photoPreview.set(null);
    this.employeeForm.reset({
      tipoDocumento: 'DNI',
      genero: 'MASCULINO',
      roleIds: [],
      especialidades: [],
      tiposEmpleado: [],
      companyId: this.activeCompanyId
    });
    this.horarios = this.diasSemana.map((d, i) => ({ diaSemana: d.key, activo: false, horaInicio: i % 2 === 0 ? '08:00' : '13:00', horaFin: i % 2 === 0 ? '13:00' : '18:00' }));
    this.isEdit.set(false);
    this.displayModal.set(true);
  }

  editEmployee(employee: EmpleadoListResponse) {
    this.isEdit.set(true);
    this.selectedFile.set(null);
    this.photoPreview.set(this.mediaService.resolveUrl(employee.fotoUrl));
    this.empleadoService.getById(employee.id).subscribe({
      next: (res) => {
        this.employeeForm.patchValue(res.data);
        if (res.data.companyId) {
          this.loadEspecialidades(res.data.companyId);
          this.loadTypesEmpleado(res.data.companyId);
        }
        this.empleadoService.getHorario(employee.id).subscribe({
          next: (hRes) => {
            this.horarios = this.diasSemana.map(d => {
              const existente = hRes.data.find(h => h.diaSemana === d.key);
              return {
                diaSemana: d.key,
                activo: existente?.activo ?? false,
                horaInicio: existente?.horaInicio ?? '08:00',
                horaFin: existente?.horaFin ?? '17:00'
              };
            });
          }
        });
        this.displayModal.set(true);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información del empleado' });
      }
    });
  }

  confirmarGuardarEmpleado() {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }
    const nombre = this.employeeForm.get('nombre')?.value?.trim();
    const apellido = this.employeeForm.get('apellido')?.value?.trim();
    this.openConfirm(
      this.isEdit() ? 'Actualizar empleado' : 'Registrar empleado',
      '¿Está seguro de ' + (this.isEdit() ? 'actualizar' : 'registrar') + ' a «' + nombre + ' ' + apellido + '»?',
      () => this.saveEmployee()
    );
  }

  private saveEmployee() {
    const doSave = (fotoUrl?: string) => {
      const horariosActivos: HorarioEmpleadoRequest[] = this.horarios
        .filter(h => h.activo)
        .map(h => ({ diaSemana: h.diaSemana, horaInicio: h.horaInicio, horaFin: h.horaFin, activo: true }));

      const rawData = this.employeeForm.value;
      const data: EmpleadoRequest = {
        ...rawData,
        nombre:            normalizeText(rawData.nombre),
        apellido:          normalizeText(rawData.apellido),
        email:             rawData.email?.trim(),
        direccion:         normalizeText(rawData.direccion),
        observaciones:     normalizeText(rawData.observaciones),
        numeroColegiatura: normalizeText(rawData.numeroColegiatura),
        horarios: horariosActivos
      };
      if (fotoUrl) data.fotoUrl = fotoUrl;
      const request = this.isEdit()
        ? this.empleadoService.actualizar(data.id!, data)
        : this.empleadoService.registrar(data);

      request.subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: this.isEdit() ? 'Empleado actualizado' : 'Empleado registrado'
          });
          this.displayModal.set(false);
          this.loadEmployees();
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Ocurrió un error al guardar'
          });
        }
      });
    };

    const file = this.selectedFile();
    if (file) {
      this.uploadingPhoto.set(true);
      this.mediaService.upload(file).subscribe({
        next: (url) => {
          this.selectedFile.set(null);
          this.uploadingPhoto.set(false);
          doSave(url);
        },
        error: () => {
          this.uploadingPhoto.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir la imagen' });
        }
      });
    } else {
      doSave();
    }
  }

  toggleStatus(employee: EmpleadoListResponse) {
    const action = employee.activo ? 'desactivar' : 'activar';
    this.openConfirm(
      'Cambiar estado',
      `¿Confirmas que deseas ${action} a ${employee.nombre} ${employee.apellido}?`,
      () => {
        this.empleadoService.cambiarEstado(employee.id, !employee.activo).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado' });
            this.loadEmployees();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
          }
        });
      }
    );
  }

  deleteEmployee(employee: EmpleadoListResponse) {
    this.openConfirm(
      'Eliminar empleado',
      `¿Estás seguro de que deseas eliminar a ${employee.nombre} ${employee.apellido}? Esta acción no se puede deshacer.`,
      () => {
        this.empleadoService.eliminar(employee.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Empleado eliminado correctamente' });
            this.loadEmployees();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el empleado' });
          }
        });
      }
    );
  }

  openPasswordResetModal(employee: EmpleadoListResponse) {
    this.selectedEmployeeForReset.set(employee);
    this.showPasswordResetModal.set(true);
  }

  submitPasswordReset() {
    const emp = this.selectedEmployeeForReset();
    if (!emp || (!emp.userId && !emp.email)) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'El empleado no tiene un usuario o correo asignado en el sistema' });
      return;
    }
    this.requestingPasswordReset.set(true);
    this.empleadoService.requestPasswordReset(emp.userId ?? null, emp.email).subscribe({
      next: () => {
        this.requestingPasswordReset.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Instrucciones enviadas',
          detail: 'El empleado deberá establecer personalmente su nueva contraseña desde el enlace recibido.'
        });
        this.showPasswordResetModal.set(false);
      },
      error: (err) => {
        this.requestingPasswordReset.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudieron enviar las instrucciones' });
      }
    });
  }
}
