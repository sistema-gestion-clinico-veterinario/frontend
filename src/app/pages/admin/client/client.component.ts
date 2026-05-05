import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { CompanyService } from '../../../core/services/company.service';
import { ApoderadoListResponse } from '../../../models/response/apoderado-list-response';
import { ApoderadoRequest } from '../../../models/request/apoderado-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';

@Component({
  selector: 'app-client',
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
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './client.component.html'
})
export class ClientComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  clients = signal<ApoderadoListResponse[]>([]);
  companies = signal<any[]>([]);
  loading = signal<boolean>(false);
  displayModal = signal<boolean>(false);
  isEdit = signal<boolean>(false);
  totalRecords = signal<number>(0);
  
  filterCompanyId: number | null = null;

  tipoDocumentos = [
    { label: 'DNI', value: 'DNI' },
    { label: 'Pasaporte', value: 'PASAPORTE' },
    { label: 'Carnet de Extranjería', value: 'CARNET_EXTRANJERIA' }
  ];

  generos = [
    { label: 'Masculino', value: 'MASCULINO' },
    { label: 'Femenino', value: 'FEMENINO' }
  ];

  clientForm: FormGroup = this.fb.group({
    id: [null],
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    numeroDocumento: ['', [Validators.required]],
    tipoDocumento: ['DNI', [Validators.required]],
    telefono: ['', [Validators.required]],
    direccion: ['', [Validators.required]],
    companyId: [null],
    genero: ['MASCULINO', [Validators.required]],
    referencias: [''],
    observaciones: ['']
  });

  ngOnInit() {
    if (this.authStore.roles().includes(Role.SUPER_ADMIN)) {
      this.loadCompanies();
      this.clientForm.get('companyId')?.setValidators([Validators.required]);
    } else {
      this.loadClients();
    }
  }

  loadClients(event: any = { first: 0, rows: 10 }) {
    const isSuperAdmin = this.authStore.roles().includes(Role.SUPER_ADMIN);
    if (isSuperAdmin && !this.filterCompanyId) {
      return;
    }

    const page = Math.floor(event.first / event.rows);
    this.loading.set(true);
    this.loadingStore.show();

    const companyId = isSuperAdmin ? (this.filterCompanyId ?? undefined) : undefined;

    this.apoderadoService.listar(companyId, undefined, undefined, page, event.rows).subscribe({
      next: (res) => {
        this.clients.set(res.data.content);
        this.totalRecords.set(res.data.totalElements);
        this.loading.set(false);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los propietarios' });
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
          // Asignar antes de llamar loadClients para evitar la condición de carrera
          this.filterCompanyId = companyList[0].value;
          this.clientForm.get('companyId')?.setValue(this.filterCompanyId);
          this.loadClients();
        }
        this.loadingStore.hide();
      },
      error: () => {
        this.loadingStore.hide();
      }
    });
  }

  onFilterCompanyChange(value: number) {
    this.filterCompanyId = value;
    this.loadClients();
    this.clientForm.get('companyId')?.setValue(value);
  }

  openNew() {
    this.clientForm.reset({
      tipoDocumento: 'DNI',
      genero: 'MASCULINO',
      companyId: this.filterCompanyId
    });
    this.isEdit.set(false);
    this.displayModal.set(true);
  }

  editClient(client: ApoderadoListResponse) {
    this.isEdit.set(true);
    this.loadingStore.show();
    this.apoderadoService.getById(client.id).subscribe({
      next: (res) => {
        this.clientForm.patchValue(res.data);
        this.displayModal.set(true);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información del dueño' });
        this.loadingStore.hide();
      }
    });
  }

  saveClient() {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const data: ApoderadoRequest = this.clientForm.value;
    const request = this.isEdit() 
      ? this.apoderadoService.actualizar(data.id!, data)
      : this.apoderadoService.registrar(data);

    this.loadingStore.show();
    request.subscribe({
      next: () => {
        this.messageService.add({ 
          severity: 'success', 
          summary: 'Éxito', 
          detail: this.isEdit() ? 'Datos actualizados' : 'Propietario registrado' 
        });
        this.displayModal.set(false);
        this.loadClients();
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

  toggleStatus(client: ApoderadoListResponse) {
    this.apoderadoService.cambiarEstado(client.id, !client.activo).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado' });
        this.loadClients();
      }
    });
  }
}
