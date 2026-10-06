import { AdminEmailChangeModalComponent } from '../../../shared/components/admin/admin-email-change-modal/admin-email-change-modal.component';
import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, finalize, forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MenuModule } from 'primeng/menu';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuItem, MessageService } from 'primeng/api';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MascotaService } from '../../../core/services/mascota.service';
import { MediaService } from '../../../core/services/media.service';
import { CompanyService } from '../../../core/services/company.service';
import { RoleService } from '../../../core/services/role.service';
import { ApoderadoListResponse } from '../../../models/response/apoderado-list-response';
import { ApoderadoRequest } from '../../../models/request/apoderado-request';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { PersonStatusAction, STATUS_ACTION_TEXT, availableStatusActions, personStatusChipClass, personStatusDotClass, personStatusLabel, describePetOutcome } from '../../../shared/utils/person-status';
import { ConflictingAppointmentsDialogComponent } from '../../../shared/components/conflicting-appointments-dialog/conflicting-appointments-dialog.component';
import { InputFilterDirective } from '../../../core/directives/input-filter.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { Role } from '../../../models/response/permission';
import { AvisoPublico, ConsentimientoEstado, PrivacidadService, RECORDATORIOS } from '../../../core/services/privacidad.service';

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
    ToastModule,
    MenuModule,
    SkeletonModule,
    HasPermissionDirective,
    InputFilterDirective,
    ConflictingAppointmentsDialogComponent,
    AdminEmailChangeModalComponent
  ],
  providers: [MessageService],
  templateUrl: './client.component.html',
  styleUrl: './client.component.scss'
})
export class ClientComponent implements OnInit {
  private readonly clientActionItemsCache = new WeakMap<ApoderadoListResponse, MenuItem[]>();
  private readonly fb = inject(FormBuilder);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly mascotaService = inject(MascotaService);
  readonly mediaService = inject(MediaService);
  private readonly companyService = inject(CompanyService);
  private readonly roleService = inject(RoleService);
  private readonly privacidadService = inject(PrivacidadService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private readonly destroyRef = inject(DestroyRef);

  emailChangeTarget = signal<ApoderadoListResponse | null>(null);
  clients = signal<ApoderadoListResponse[]>([]);
  cargando = signal<boolean>(true);
  displayModal = signal<boolean>(false);
  isEdit = signal<boolean>(false);
  totalRecords = signal<number>(0);
  confirmDialog = signal<{ title: string; message: string; onConfirm: (reason?: string) => void; askReason: boolean; confirmLabel?: string } | null>(null);
  confirmReason = signal('');
  private pendingStatus: { action: PersonStatusAction; reason?: string } | null = null;
  displayDetailModal = signal<boolean>(false);
  selectedClientDetail = signal<ApoderadoRequest | null>(null);
  selectedClientId = signal<number | null>(null);
  clientPets = signal<MascotaResponse[]>([]);
  clientRoles = signal<Role[]>([]);
  avisoPrivacidad = signal<AvisoPublico | null>(null);
  cargandoAviso = signal(false);
  estadoPrivacidadCliente = signal<ConsentimientoEstado | null>(null);
  actualizandoPrivacidadCliente = signal(false);

  searchNombre = signal('');
  searchDocumento = signal('');
  private pageSize = 10;
  private readonly searchTrigger = new Subject<void>();
  private hasSearched = false;
  private readonly nameFilterPattern = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?: [A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/;
  private readonly documentFilterPattern = /^(?:\d{8}|\d{9}|[A-Za-z]\d{8})$/;

  especieLabel(especie: string): string {
    const m: Record<string, string> = {
      PERRO: 'Perro', GATO: 'Gato', AVE: 'Ave',
      CONEJO: 'Conejo', REPTIL: 'Reptil', OTRO: 'Otro'
    };
    return m[especie?.toUpperCase()] ?? especie;
  }

  especieBadgeClass(especie: string): string {
    switch (especie?.toUpperCase()) {
      case 'PERRO':  return 'bg-blue-50 text-blue-700';
      case 'GATO':   return 'bg-violet-50 text-violet-700';
      case 'AVE':    return 'bg-amber-50 text-amber-700';
      case 'CONEJO': return 'bg-green-50 text-green-700';
      case 'REPTIL': return 'bg-teal-50 text-teal-700';
      default:       return 'bg-slate-100 text-slate-500';
    }
  }

  especieAvatarClass(especie: string): string {
    switch (especie?.toUpperCase()) {
      case 'PERRO':  return 'bg-blue-100 text-blue-700';
      case 'GATO':   return 'bg-violet-100 text-violet-700';
      case 'AVE':    return 'bg-amber-100 text-amber-700';
      case 'CONEJO': return 'bg-green-100 text-green-700';
      case 'REPTIL': return 'bg-teal-100 text-teal-700';
      default:       return 'bg-slate-100 text-slate-500';
    }
  }

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  openConfirm(title: string, message: string, onConfirm: (reason?: string) => void, askReason = false, confirmLabel?: string) {
    this.confirmReason.set('');
    this.confirmDialog.set({ title, message, onConfirm, askReason, confirmLabel });
  }

  confirmAction() {
    this.confirmDialog()?.onConfirm(this.confirmReason().trim() || undefined);
    this.confirmDialog.set(null);
  }

  cancelConfirm() {
    this.confirmDialog.set(null);
  }

  canClientAction(tipo: 'leer' | 'modificar' | 'eliminar'): boolean {
    return this.authStore.hasAccess('VISTA_CLIENTES', tipo);
  }

  clientActionItems(client: ApoderadoListResponse): MenuItem[] {
    const cached = this.clientActionItemsCache.get(client);
    if (cached) return cached;

    const items: MenuItem[] = [];

    if (this.canClientAction('leer')) {
      items.push({
        label: 'Ver Detalles',
        icon: 'pi pi-eye',
        command: () => this.viewClientDetail(client)
      });
    }

    if (this.authStore.hasAccess('VISTA_GESTION_CREDENCIALES', 'modificar') && client.activo && client.userId) {
      items.push({
        label: client.cuentaPendiente ? 'Corregir correo' : 'Cambiar correo de acceso',
        icon: 'pi pi-at',
        command: () => this.emailChangeTarget.set(client)
      });
    }

    if (this.canClientAction('modificar') && client.puedeReenviarInvitacion) {
      items.push({
        label: 'Reenviar invitación',
        icon: 'pi pi-send',
        command: () => this.reenviarInvitacion(client)
      });
    }

    if (this.canClientAction('modificar')) {
      items.push({
        label: 'Editar',
        icon: 'pi pi-pencil',
        disabled: !client.activo,
        command: () => this.editClient(client)
      });
      for (const action of availableStatusActions({ activo: client.activo, tipoInactividad: client.tipoInactividad })) {
        items.push({
          label: STATUS_ACTION_TEXT[action].menuLabel,
          icon: STATUS_ACTION_TEXT[action].icon,
          command: () => this.changeStatus(client, action)
        });
      }
    }

    if (this.canClientAction('eliminar') && this.authStore.isAdmin()) {
      items.push({
        label: 'Eliminar',
        icon: 'pi pi-trash',
        command: () => this.deleteClient(client)
      });
    }

    this.clientActionItemsCache.set(client, items);
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
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), Validators.maxLength(100)]],
    username: ['', [
      (control: AbstractControl) => (!this.isEdit() && !control.value?.trim()) ? { required: true } : null,
      noLeadingTrailingSpaceValidator(),
      Validators.maxLength(50),
      Validators.pattern(/^$|^[a-zA-Z0-9._-]+$/)
    ]],
    numeroDocumento: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    tipoDocumento: ['DNI', [Validators.required]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    direccion: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s\.,#\-\/°:]+$/), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    companyId: [null],
    roleIds: [[], [(control: AbstractControl) => control.value?.length ? null : { required: true }]],
    genero: ['MASCULINO', [Validators.required]],
    referencias: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    observaciones: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    avisoInformado: [false],
    consentimientoRecordatorios: [null]
  });

  get documentoErrorMsg(): string {
    const tipo = this.clientForm.get('tipoDocumento')?.value;
    if (tipo === 'PASAPORTE') return 'El pasaporte debe comenzar con una letra seguida de 8 números';
    if (tipo === 'CARNET_EXTRANJERIA') return 'El carnet de extranjería debe tener exactamente 9 dígitos';
    return 'El DNI debe tener exactamente 8 dígitos';
  }

  onDocInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const tipo = this.clientForm.get('tipoDocumento')?.value;
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
      this.clientForm.get('numeroDocumento')?.setValue(filtered, { emitEvent: false });
    }
  }

  ngOnInit() {
    const companyId = this.activeCompanyId;
    if (companyId) {
      this.loadClientRoles(companyId);
      this.clientForm.get('companyId')?.setValue(companyId);
    }
    this.loadClients({ first: 0, rows: this.pageSize });
    this.loadAvisoPrivacidad();

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
    this.hasSearched = true;
    if (!this.normalizeAndValidateFilters()) return;
    this.searchTrigger.next();
  }

  clearSearch() {
    this.hasSearched = true;
    this.searchNombre.set('');
    this.searchDocumento.set('');
    this.searchTrigger.next();
  }

  onClientNameFilterInput(value: string) {
    this.searchNombre.set(this.sanitizeNameFilter(value));
  }

  onClientDocumentFilterInput(value: string) {
    this.searchDocumento.set(this.sanitizeDocumentFilter(value));
  }

  loadClients(event: any = { first: 0, rows: this.pageSize }) {
    const companyId = this.activeCompanyId;
    const isFirstLoad = this.clients().length === 0;
    if (isFirstLoad) this.cargando.set(true);
    this.pageSize = event.rows;
    const page = Math.floor(event.first / event.rows);

    const nombre = this.normalizeNameFilter(this.searchNombre()) || undefined;
    const numeroDocumento = this.searchDocumento().trim().toUpperCase() || undefined;

    this.apoderadoService.listar(companyId ?? undefined, nombre, numeroDocumento, page, event.rows).pipe(
      finalize(() => this.cargando.set(false))
    ).subscribe({
      next: (res) => {
        this.clients.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los propietarios' });
      }
    });
  }

  private normalizeAndValidateFilters(): boolean {
    const nombre = this.normalizeNameFilter(this.searchNombre());
    const documento = this.searchDocumento().trim().toUpperCase();

    this.searchNombre.set(nombre);
    this.searchDocumento.set(documento);

    if (nombre && !this.nameFilterPattern.test(nombre)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Filtro inválido',
        detail: 'El nombre o apellido solo debe contener letras y espacios entre palabras.'
      });
      return false;
    }

    if (documento && !this.documentFilterPattern.test(documento)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Documento inválido',
        detail: 'Ingrese un DNI de 8 dígitos, carnet de extranjería de 9 dígitos o pasaporte con una letra y 8 números.'
      });
      return false;
    }

    return true;
  }

  private sanitizeNameFilter(value: string): string {
    return (value ?? '')
      .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+/, '')
      .slice(0, 80);
  }

  private normalizeNameFilter(value: string): string {
    return this.sanitizeNameFilter(value).trim().replace(/\s+/g, ' ');
  }

  private sanitizeDocumentFilter(value: string): string {
    return (value ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 9);
  }



  openNew() {
    const defaultRole = this.clientRoles().find(role => role.purpose === 'CLIENT_PORTAL')
      ?? this.clientRoles()[0];
    this.clientForm.reset({
      tipoDocumento: 'DNI',
      genero: 'MASCULINO',
      companyId: this.activeCompanyId,
      roleIds: defaultRole ? [defaultRole.id] : [],
      avisoInformado: false,
      consentimientoRecordatorios: null
    });
    this.setPrivacyValidators(true);
    this.isEdit.set(false);
    this.displayModal.set(true);
  }

  loadClientRoles(companyId: number) {
    this.roleService.listarRolesClienteAsignables(companyId).subscribe({
      next: ({ data }) => this.clientRoles.set(data ?? []),
      error: () => {
        this.clientRoles.set([]);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los roles de acceso para clientes'
        });
      }
    });
  }

  isClientRoleSelected(roleId: number): boolean {
    return (this.clientForm.get('roleIds')?.value ?? []).includes(roleId);
  }

  toggleClientRole(roleId: number, checked: boolean) {
    const control = this.clientForm.get('roleIds');
    const selected = new Set<number>(control?.value ?? []);
    checked ? selected.add(roleId) : selected.delete(roleId);
    control?.setValue([...selected]);
    control?.markAsTouched();
  }

  viewClientDetail(client: ApoderadoListResponse) {
    const companyId = this.activeCompanyId;
    this.loadingStore.show();
    forkJoin({
      detail: this.apoderadoService.getById(client.id),
      pets: this.mascotaService.listar(companyId ?? undefined, undefined, undefined, 0, 500, undefined),
      privacidad: this.privacidadService.estadoDelCliente(client.id)
    }).subscribe({
      next: (res) => {
        const allPets = res.pets.data?.content ?? [];
        this.clientPets.set(allPets.filter(p => p.apoderadoId === client.id));
        this.selectedClientDetail.set(res.detail.data);
        this.selectedClientId.set(client.id);
        this.estadoPrivacidadCliente.set(res.privacidad.data);
        this.displayDetailModal.set(true);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información del cliente' });
        this.loadingStore.hide();
      }
    });
  }

  estadoRecordatoriosCliente(): 'OTORGADO' | 'RETIRADO' | 'SIN_REGISTRO' {
    return this.estadoPrivacidadCliente()?.finalidades.find(f => f.codigo === RECORDATORIOS)?.estado ?? 'SIN_REGISTRO';
  }

  informarCliente() {
    const id = this.selectedClientId();
    if (!id || !this.canClientAction('modificar') || this.actualizandoPrivacidadCliente()) return;
    this.actualizandoPrivacidadCliente.set(true);
    this.privacidadService.informarAlCliente(id).subscribe({
      next: ({ data }) => {
        this.estadoPrivacidadCliente.set(data);
        this.actualizandoPrivacidadCliente.set(false);
        this.messageService.add({ severity: 'success', summary: 'Constancia registrada', detail: 'Se guardó que el cliente fue informado del aviso vigente.' });
      },
      error: (err) => this.errorPrivacidadCliente(err)
    });
  }

  decidirRecordatoriosCliente(otorgar: boolean) {
    const id = this.selectedClientId();
    if (!id || !this.canClientAction('modificar') || this.actualizandoPrivacidadCliente()) return;
    this.actualizandoPrivacidadCliente.set(true);
    this.privacidadService.decidirPorElCliente(id, RECORDATORIOS, otorgar).subscribe({
      next: ({ data }) => {
        this.estadoPrivacidadCliente.set(data);
        this.actualizandoPrivacidadCliente.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Decisión registrada',
          detail: otorgar ? 'El cliente aceptó recibir recordatorios.' : 'El cliente no recibirá recordatorios.'
        });
      },
      error: (err) => this.errorPrivacidadCliente(err)
    });
  }

  private errorPrivacidadCliente(err: any) {
    this.actualizandoPrivacidadCliente.set(false);
    this.messageService.add({
      severity: 'error',
      summary: 'No se pudo registrar la decisión',
      detail: err?.error?.message ?? 'Inténtalo nuevamente.'
    });
  }

  editClient(client: ApoderadoListResponse) {
    this.isEdit.set(true);
    this.setPrivacyValidators(false);
    this.loadingStore.show();
    this.apoderadoService.getById(client.id).subscribe({
      next: (res) => {
        this.clientForm.patchValue(res.data);
        if (res.data.companyId) {
          this.loadClientRoles(res.data.companyId);
        }
        this.displayModal.set(true);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información del dueño' });
        this.loadingStore.hide();
      }
    });
  }

  private loadAvisoPrivacidad() {
    this.cargandoAviso.set(true);
    this.privacidadService.avisoVigente().pipe(
      finalize(() => this.cargandoAviso.set(false))
    ).subscribe({
      next: ({ data }) => this.avisoPrivacidad.set(data ?? null),
      error: () => this.avisoPrivacidad.set(null)
    });
  }

  private setPrivacyValidators(required: boolean) {
    const informado = this.clientForm.get('avisoInformado');
    informado?.setValidators(required ? [Validators.requiredTrue] : []);
    informado?.updateValueAndValidity({ emitEvent: false });
  }

  saveClient() {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Por favor completa todos los campos requeridos correctamente.' });
      return;
    }

    const rawData = this.clientForm.value;
    const data: ApoderadoRequest = {
      ...rawData,
      nombre:        normalizeText(rawData.nombre),
      apellido:      normalizeText(rawData.apellido),
      email:         rawData.email?.trim(),
      username:      rawData.username?.trim().toLowerCase(),
      direccion:     normalizeText(rawData.direccion),
      referencias:   normalizeText(rawData.referencias),
      observaciones: normalizeText(rawData.observaciones)
    };

    const action = this.isEdit() ? 'actualizar' : 'registrar';
    this.openConfirm(
      this.isEdit() ? 'Modificar cliente' : 'Registrar cliente',
      `¿Confirmas que deseas ${action} a ${data.nombre} ${data.apellido}?`,
      () => this.submitClient(data)
    );
  }

  private submitClient(data: ApoderadoRequest) {
    const request = this.isEdit()
      ? this.apoderadoService.actualizar(data.id!, data)
      : this.apoderadoService.registrar(data);

    this.loadingStore.show();
    request.subscribe({
      next: (response) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.isEdit() ? 'Datos actualizados' : 'Propietario registrado'
        });
        // La persona ya existía (por DNI o correo) y se reutilizó su identidad - el
        // correo escrito en este formulario se descartó, avisar cuál quedó guardado.
        const data = (response as any)?.data;
        if (data?.identidadExistente) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Persona ya registrada',
            detail: `Esta persona ya existe en el sistema con el correo ${data.correoExistente}. Se usó ese correo en vez del que escribiste.`,
            life: 10000
          });
        }
        this.displayModal.set(false);
        this.loadClients();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.loadingStore.hide();
        const existente = err.status === 409 && err.error?.data?.code === 'CLIENTE_INACTIVO' ? err.error.data : null;
        if (existente) {
          this.offerReactivation(data, existente.apoderadoId as number, existente.tipoInactividad as 'BAJA' | 'SUSPENSION');
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Ocurrió un error al guardar'
        });
      }
    });
  }

  private offerReactivation(data: ApoderadoRequest, apoderadoId: number, tipo: 'BAJA' | 'SUSPENSION') {
    const nombre = `${data.nombre} ${data.apellido}`;
    const estado = tipo === 'SUSPENSION' ? 'está suspendido' : 'fue dado de baja';
    this.openConfirm(
      'Cliente ya registrado',
      `Ya existe un cliente con esos datos y ${estado}. ${STATUS_ACTION_TEXT['REACTIVAR'].confirm(nombre, 'cliente')}`,
      () => this.reactivateExisting(apoderadoId),
      false,
      'Reactivar'
    );
  }

  private reactivateExisting(apoderadoId: number) {
    this.loadingStore.show();
    this.apoderadoService.cambiarEstado(apoderadoId, true, {}).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: STATUS_ACTION_TEXT['REACTIVAR'].success });
        const mascotas = describePetOutcome(res.data);
        if (mascotas) {
          this.messageService.add({ severity: mascotas.severity, summary: 'Mascotas del cliente', detail: mascotas.detail, life: 12000 });
        }
        this.displayModal.set(false);
        this.loadClients();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo reactivar al cliente' });
        this.loadingStore.hide();
      }
    });
  }

  conflictDialogVisible = signal(false);
  conflictClient = signal<ApoderadoListResponse | null>(null);

  onConflictsResolved() {
    const client = this.conflictClient();
    const pending = this.pendingStatus;
    if (!client || !pending) return;
    this.applyStatus(client, pending.action, pending.reason, true);
  }

  onEmailChangeSent(message: string) {
    const corregido = !!this.emailChangeTarget()?.cuentaPendiente;
    this.emailChangeTarget.set(null);
    this.messageService.add({
      severity: 'success',
      summary: corregido ? 'Correo corregido' : 'Confirmación enviada',
      detail: message
    });
    if (corregido) this.loadClients();
  }

  reenviarInvitacion(client: ApoderadoListResponse) {
    this.openConfirm(
      'Reenviar invitación',
      `¿Enviar un enlace de activación nuevo a ${client.email}? El enlace anterior dejará de funcionar.`,
      () => {
        this.apoderadoService.reenviarInvitacion(client.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Invitación enviada', detail: `Se envió un enlace nuevo a ${client.email}` });
            this.loadClients();
          },
          error: (err) => this.messageService.add({
            severity: 'error', summary: 'No se reenvió la invitación',
            detail: err.error?.message || 'Intenta nuevamente.'
          })
        });
      }
    );
  }

  changeStatus(client: ApoderadoListResponse, action: PersonStatusAction) {
    const text = STATUS_ACTION_TEXT[action];
    const nombre = `${client.nombre} ${client.apellido}`;
    this.openConfirm(
      text.title,
      text.confirm(nombre, 'cliente'),
      (reason) => {
        this.pendingStatus = { action, reason };
        this.applyStatus(client, action, reason);
      },
      text.askReason
    );
  }

  private applyStatus(client: ApoderadoListResponse, action: PersonStatusAction, reason?: string, fromConflict = false) {
    const tipo = action === 'REACTIVAR' ? undefined : action;
    this.apoderadoService.cambiarEstado(client.id, action === 'REACTIVAR', { tipo, reason }).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: STATUS_ACTION_TEXT[action].success });
        const mascotas = describePetOutcome(res.data);
        if (mascotas) {
          this.messageService.add({ severity: mascotas.severity, summary: 'Mascotas del cliente', detail: mascotas.detail, life: 12000 });
        }
        if (fromConflict) this.conflictClient.set(null);
        this.loadClients();
      },
      error: (err) => {
        const message = err.error?.message || 'No se pudo cambiar el estado';
        if (!fromConflict && message.includes('citas programadas vigentes')) {
          this.conflictClient.set(client);
          this.conflictDialogVisible.set(true);
        }
        this.messageService.add({ severity: 'error', summary: 'Error', detail: message });
      }
    });
  }

  statusLabel = personStatusLabel;
  statusChipClass = personStatusChipClass;
  statusDotClass = personStatusDotClass;
  deleteClient(client: ApoderadoListResponse) {
    this.openConfirm(
      'Eliminar cliente',
      `¿Eliminar a ${client.nombre} ${client.apellido}? Se le dará de baja: deja de operar en la clínica y sus registros se conservan. Podrás reactivarlo si vuelve.`,
      () => {
        this.loadingStore.show();
        this.apoderadoService.eliminar(client.id).subscribe({
          next: (res) => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: STATUS_ACTION_TEXT['BAJA'].success });
            const mascotas = describePetOutcome(res.data);
            if (mascotas) {
              this.messageService.add({ severity: mascotas.severity, summary: 'Mascotas del cliente', detail: mascotas.detail, life: 12000 });
            }
            this.loadClients();
            this.loadingStore.hide();
          },
          error: (err) => {
            const message = err.error?.message || 'No se pudo eliminar al cliente';
            if (message.includes('citas programadas vigentes')) {
              this.pendingStatus = { action: 'BAJA', reason: 'Eliminado por el administrador' };
              this.conflictClient.set(client);
              this.conflictDialogVisible.set(true);
            }
            this.messageService.add({ severity: 'error', summary: 'Error', detail: message });
            this.loadingStore.hide();
          }
        });
      }
    );
  }
}
