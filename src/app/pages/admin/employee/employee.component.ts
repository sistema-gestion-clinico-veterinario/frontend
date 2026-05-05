import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { CompanyService } from '../../../core/services/company.service';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { TipoEmpleadoService } from '../../../core/services/tipo-empleado.service';
import { EmpleadoListResponse } from '../../../models/response/empleado-list-response';
import { EmpleadoRequest } from '../../../models/request/empleado-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    MultiSelectModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './employee.component.html'
})
export class EmployeeComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  private readonly especialidadService = inject(EspecialidadService);
  private readonly tipoEmpleadoService = inject(TipoEmpleadoService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  employees = signal<EmpleadoListResponse[]>([]);
  companies = signal<any[]>([]);
  loading = signal<boolean>(false);
  displayModal = signal<boolean>(false);
  isEdit = signal<boolean>(false);
  especialidadesList = signal<any[]>([]);
  tiposEmpleadoList = signal<any[]>([]);
  totalRecords = signal<number>(0);

  filterCompanyId: number | null = null;

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


  employeeForm: FormGroup = this.fb.group({
    id: [null],
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    numeroDocumento: ['', [Validators.required]],
    tipoDocumento: ['DNI', [Validators.required]],
    telefono: ['', [Validators.required]],
    direccion: ['', [Validators.required]],
    roles: [[], [Validators.required]],
    companyId: [null],
    genero: ['MASCULINO', [Validators.required]],
    observaciones: [''],
    fotoUrl: [''],
    numeroColegiatura: [''],
    especialidades: [[]],
    tiposEmpleado: [[]]
  });

  ngOnInit() {
    if (this.authStore.roles().includes(Role.SUPER_ADMIN)) {
      this.loadCompanies();
      this.employeeForm.get('companyId')?.setValidators([Validators.required]);
    } else {
      this.loadEmployees();
      this.loadEspecialidades();
      this.loadTypesEmpleado();
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
  }

  loadEmployees(event: any = { first: 0, rows: 10 }) {
    if (this.authStore.roles().includes(Role.SUPER_ADMIN) && !this.filterCompanyId) {
      return;
    }

    const page = event.first / event.rows;
    this.loading.set(true);
    this.loadingStore.show();

    const companyId = this.authStore.roles().includes(Role.SUPER_ADMIN)
      ? (this.filterCompanyId ?? undefined)
      : undefined;

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

  loadCompanies() {
    this.loadingStore.show();
    this.companyService.listar(0, 1000).subscribe({
      next: (res) => {
        const companyList = res.data.content.map(c => ({ label: c.name, value: c.id }));
        this.companies.set(companyList);

        if (companyList.length > 0 && !this.filterCompanyId) {
          this.filterCompanyId = companyList[0].value;
          this.loadEmployees();
          this.loadEspecialidades(this.filterCompanyId!);
          this.loadTypesEmpleado(this.filterCompanyId!);
        }
        this.loadingStore.hide();
      },
      error: () => {
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

  onFilterCompanyChange(value: number) {
    this.filterCompanyId = value;
    this.loadEmployees();
    this.loadEspecialidades(value);
    this.loadTypesEmpleado(value);
    this.employeeForm.get('companyId')?.setValue(value);
  }

  loadTypesEmpleado(companyId?: number) {
    this.tipoEmpleadoService.listar(companyId).subscribe({
      next: (res) => {
        const list = res.data.content.map(t => ({ label: t.nombre, value: t.nombre }));
        this.tiposEmpleadoList.set(list);
      }
    });
  }

  openNew() {
    this.employeeForm.reset({
      tipoDocumento: 'DNI',
      genero: 'MASCULINO',
      roles: [],
      especialidades: [],
      tiposEmpleado: [],
      companyId: this.filterCompanyId
    });
    this.isEdit.set(false);
    this.displayModal.set(true);
  }

  editEmployee(employee: EmpleadoListResponse) {
    this.isEdit.set(true);
    this.loadingStore.show();
    this.empleadoService.getById(employee.id).subscribe({
      next: (res) => {
        this.employeeForm.patchValue(res.data);
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

    const data: EmpleadoRequest = this.employeeForm.value;
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
    this.empleadoService.cambiarEstado(employee.id, !employee.activo).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado' });
        this.loadEmployees();
      }
    });
  }
}
