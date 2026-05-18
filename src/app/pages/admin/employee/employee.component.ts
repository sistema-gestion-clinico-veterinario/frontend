import { Component, OnInit, inject, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
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
import { MessageService } from 'primeng/api';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { MediaService } from '../../../core/services/media.service';
import { CompanyService } from '../../../core/services/company.service';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { TipoEmpleadoService } from '../../../core/services/tipo-empleado.service';
import { EmpleadoListResponse } from '../../../models/response/empleado-list-response';
import { EmpleadoRequest, HorarioEmpleadoRequest } from '../../../models/request/empleado-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';
import { Permission } from '../../../core/enums/permission.enum';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

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
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './employee.component.html'
})
export class EmployeeComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly mediaService = inject(MediaService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  private readonly especialidadService = inject(EspecialidadService);
  private readonly tipoEmpleadoService = inject(TipoEmpleadoService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  @ViewChild('empFileInput') empFileInput!: ElementRef<HTMLInputElement>;

  uploadingPhoto = signal(false);
  photoPreview = signal<string | null>(null);

  confirmDialog = signal<{ title: string; message: string; onConfirm: () => void } | null>(null);

  employees = signal<EmpleadoListResponse[]>([]);
  loading = signal<boolean>(false);
  displayModal = signal<boolean>(false);
  isEdit = signal<boolean>(false);
  especialidadesList = signal<any[]>([]);
  tiposEmpleadoList = signal<any[]>([]);
  totalRecords = signal<number>(0);
  openDropdown = signal<string | null>(null);
  searchFilter = signal<string>('');

  public toggleDropdown(name: string, event?: Event) {
    if (event) event.stopPropagation();
    if (this.openDropdown() === name) {
      this.openDropdown.set(null);
    } else {
      this.openDropdown.set(name);
      this.searchFilter.set('');
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

  readonly Permission = Permission;

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

  roles = [
    { label: 'Administrador', value: 'ROLE_ADMIN' },
    { label: 'Veterinario', value: 'ROLE_VETERINARIO' },
    { label: 'Recepcionista', value: 'ROLE_RECEPCIONISTA' }
  ];

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
    nombre: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/)]],
    apellido: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    numeroDocumento: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    tipoDocumento: ['DNI', [Validators.required]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    direccion: ['', [Validators.required]],
    roles: [[], [(c: AbstractControl) => c.value?.length ? null : { required: true }]],
    companyId: [null],
    genero: ['MASCULINO', [Validators.required]],
    observaciones: [''],
    fotoUrl: [''],
    numeroColegiatura: [''],
    especialidades: [[]],
    tiposEmpleado: [[]]
  });

  ngOnInit() {
    const companyId = this.activeCompanyId;
    if (companyId) {
      this.loadEmployees();
      this.loadEspecialidades(companyId);
      this.loadTypesEmpleado(companyId);
      this.employeeForm.get('companyId')?.setValue(companyId);
    }

    this.employeeForm.get('roles')?.valueChanges.subscribe(roles => {
      const isVet = roles?.includes(Role.VETERINARIO);
      const collegiatura = this.employeeForm.get('numeroColegiatura');
      if (isVet) {
        collegiatura?.setValidators([Validators.required]);
      } else {
        collegiatura?.clearValidators();
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
        return;
      }
      this.loadEspecialidades(companyId);
      this.loadTypesEmpleado(companyId);
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

    const page = event.first / event.rows;
    this.loading.set(true);
    this.loadingStore.show();

    this.empleadoService.listar(companyId, undefined, page, event.rows).subscribe({
      next: (res) => {
        this.employees.set(res.data.content);
        this.totalRecords.set(res.data.totalElements);
        this.loading.set(false);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los empleados' });
        this.loading.set(false);
        this.loadingStore.hide();
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
        const list = res.data.content.map(t => ({ label: t.nombre, value: t.nombre }));
        this.tiposEmpleadoList.set(list);
      }
    });
  }


  triggerPhotoInput() {
    this.empFileInput.nativeElement.click();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      this.messageService.add({ severity: 'warn', summary: 'Formato no válido', detail: 'Solo JPG, PNG, WEBP o GIF' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo muy grande', detail: 'Máximo 5 MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => this.photoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);

    this.uploadingPhoto.set(true);
    this.mediaService.upload(file).subscribe({
      next: (url) => {
        this.employeeForm.patchValue({ fotoUrl: url });
        this.uploadingPhoto.set(false);
        this.messageService.add({ severity: 'success', summary: 'Foto cargada', detail: 'Guarda el formulario para aplicar' });
      },
      error: () => {
        this.photoPreview.set(null);
        this.uploadingPhoto.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir la imagen' });
      }
    });

    input.value = '';
  }

  openNew() {
    this.photoPreview.set(null);
    this.employeeForm.reset({
      tipoDocumento: 'DNI',
      genero: 'MASCULINO',
      roles: [],
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
    this.photoPreview.set(this.mediaService.resolveUrl(employee.fotoUrl));
    this.loadingStore.show();
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
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información del empleado' });
        this.loadingStore.hide();
      }
    });
  }

  saveEmployee() {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const horariosActivos: HorarioEmpleadoRequest[] = this.horarios
      .filter(h => h.activo)
      .map(h => ({ diaSemana: h.diaSemana, horaInicio: h.horaInicio, horaFin: h.horaFin, activo: true }));

    const data: EmpleadoRequest = { ...this.employeeForm.value, horarios: horariosActivos };
    const request = this.isEdit()
      ? this.empleadoService.actualizar(data.id!, data)
      : this.empleadoService.registrar(data);

    this.loadingStore.show();
    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEdit() ? 'Empleado actualizado' : 'Empleado registrado'
        });
        this.displayModal.set(false);
        this.loadEmployees();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Ocurrió un error al guardar'
        });
        this.loadingStore.hide();
      }
    });
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
        this.loadingStore.show();
        this.empleadoService.eliminar(employee.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Empleado eliminado correctamente' });
            this.loadEmployees();
            this.loadingStore.hide();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el empleado' });
            this.loadingStore.hide();
          }
        });
      }
    );
  }
}
