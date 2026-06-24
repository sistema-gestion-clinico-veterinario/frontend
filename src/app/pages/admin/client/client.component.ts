import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MenuModule } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { CompanyService } from '../../../core/services/company.service';
import { ApoderadoListResponse } from '../../../models/response/apoderado-list-response';
import { ApoderadoRequest } from '../../../models/request/apoderado-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { InputFilterDirective } from '../../../core/directives/input-filter.directive';

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
    ToastModule,
    MenuModule,
    HasPermissionDirective,
    InputFilterDirective
  ],
  providers: [MessageService],
  templateUrl: './client.component.html',
  styleUrl: './client.component.scss'
})
export class ClientComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private readonly destroyRef = inject(DestroyRef);

  clients = signal<ApoderadoListResponse[]>([]);
  loading = signal<boolean>(false);
  displayModal = signal<boolean>(false);
  isEdit = signal<boolean>(false);
  totalRecords = signal<number>(0);
  confirmDialog = signal<{ title: string; message: string; onConfirm: () => void } | null>(null);

  searchNombre = signal('');
  searchDocumento = signal('');
  private pageSize = 10;
  private readonly searchTrigger = new Subject<void>();


  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
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

  canClientAction(tipo: 'modificar' | 'eliminar'): boolean {
    return this.authStore.isSuperAdmin() || this.authStore.hasAccess('VISTA_CLIENTES', tipo);
  }

  clientActionItems(client: ApoderadoListResponse): MenuItem[] {
    const items: MenuItem[] = [];

    if (this.canClientAction('modificar')) {
      items.push({
        label: 'Editar',
        icon: 'pi pi-pencil',
        disabled: !client.activo,
        command: () => this.editClient(client)
      });
    }

    if (this.canClientAction('eliminar')) {
      items.push({
        label: 'Eliminar',
        icon: 'pi pi-trash',
        command: () => this.deleteClient(client)
      });
    }

    return items;
  }

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
    nombre: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/)]],
    apellido: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    numeroDocumento: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    tipoDocumento: ['DNI', [Validators.required]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    direccion: ['', [Validators.required]],
    companyId: [null],
    genero: ['MASCULINO', [Validators.required]],
    referencias: [''],
    observaciones: ['']
  });

  get documentoErrorMsg(): string {
    const tipo = this.clientForm.get('tipoDocumento')?.value;
    if (tipo === 'PASAPORTE') return 'El pasaporte debe comenzar con una letra seguida de 8 números';
    if (tipo === 'CARNET_EXTRANJERIA') return 'El carnet de extranjería debe tener exactamente 9 dígitos';
    return 'El DNI debe tener exactamente 8 dígitos';
  }

  ngOnInit() {
    this.searchTrigger.pipe(
      debounceTime(400),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.loadClients({ first: 0, rows: this.pageSize }));

    this.clientForm.get('tipoDocumento')?.valueChanges.subscribe(tipo => {
      const doc = this.clientForm.get('numeroDocumento');
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
  }

  onSearchChange() {
    this.searchTrigger.next();
  }

  clearSearch() {
    this.searchNombre.set('');
    this.searchDocumento.set('');
    this.loadClients({ first: 0, rows: this.pageSize });
  }

  loadClients(event: any = { first: 0, rows: this.pageSize }) {
    const companyId = this.activeCompanyId;
    if (!companyId) return;

    this.pageSize = event.rows;
    const page = Math.floor(event.first / event.rows);
    this.loading.set(true);
    this.loadingStore.show();

    const nombre = this.searchNombre().trim() || undefined;
    const numeroDocumento = this.searchDocumento().trim() || undefined;

    this.apoderadoService.listar(companyId, nombre, numeroDocumento, page, event.rows).subscribe({
      next: (res) => {
        this.clients.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
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



  openNew() {
    this.clientForm.reset({
      tipoDocumento: 'DNI',
      genero: 'MASCULINO',
      companyId: this.activeCompanyId
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
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Por favor completa todos los campos requeridos correctamente.' });
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
    const action = client.activo ? 'desactivar' : 'activar';
    this.openConfirm(
      'Cambiar estado',
      `¿Confirmas que deseas ${action} a ${client.nombre} ${client.apellido}?`,
      () => {
        this.apoderadoService.cambiarEstado(client.id, !client.activo).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado' });
            this.loadClients();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cambiar el estado' });
          }
        });
      }
    );
  }

  deleteClient(client: ApoderadoListResponse) {
    this.openConfirm(
      'Eliminar propietario',
      `¿Estás seguro de que deseas eliminar a ${client.nombre} ${client.apellido}? Esta acción no se puede deshacer.`,
      () => {
        this.loadingStore.show();
        this.apoderadoService.eliminar(client.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Propietario eliminado correctamente' });
            this.loadClients();
            this.loadingStore.hide();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el propietario' });
            this.loadingStore.hide();
          }
        });
      }
    );
  }
}
