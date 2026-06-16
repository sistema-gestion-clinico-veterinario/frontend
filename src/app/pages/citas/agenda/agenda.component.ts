import { Component, OnInit, OnDestroy, ViewChild, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { CitaService } from '../../../core/services/cita.service';
import { CajaService } from '../../../core/services/caja.service';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MascotaService } from '../../../core/services/mascota.service';
import { RazaService } from '../../../core/services/raza.service';
import { RazaResponse } from '../../../models/response/raza-response';
import { CompanyService } from '../../../core/services/company.service';
import { ServicioService } from '../../../core/services/servicio.service';
import { PagoService } from '../../../core/services/pago.service';
import { ServicioResponse } from '../../../models/response/servicio-response';
import { MetodoPago, PagoRequest } from '../../../models/request/pago-request';
import { CitaResponse } from '../../../models/response/cita-response';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { HorarioEmpleadoResponse } from '../../../models/response/horario-empleado-response';
import { CitaRequest } from '../../../models/request/cita-request';
import { EstadoCita } from '../../../core/enums/estado-cita.enum';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventContentArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
export type Vista = 'lista' | 'dia' | 'semana' | 'mes';

interface CitaWsEvent {
  tipo: string;
  cita: CitaResponse;
  companyId: number;
}

interface HorarioResumen {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  rangoFechas: string;
  totalFechas: number;
}

@Component({
  selector: 'app-agenda',
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
    CalendarModule,
    TooltipModule,
    MenuModule,

    ConfirmDialogModule,
    ToastModule,
    FullCalendarModule,
    HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './agenda.component.html'
})
export class AgendaComponent implements OnInit, OnDestroy {
  @ViewChild('fullCalendar') fullCalendar?: FullCalendarComponent;

  private readonly fb                = inject(FormBuilder);
  private readonly citaService       = inject(CitaService);
  private readonly empleadoService   = inject(EmpleadoService);
  private readonly apoderadoService  = inject(ApoderadoService);
  private readonly mascotaService    = inject(MascotaService);
  private readonly razaService       = inject(RazaService);
  private readonly companyService    = inject(CompanyService);
  private readonly servicioService   = inject(ServicioService);
  private readonly pagoService       = inject(PagoService);
  private readonly cajaService       = inject(CajaService);
  private readonly messageService    = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router            = inject(Router);
  readonly authStore                 = inject(AuthStore);
  readonly loadingStore              = inject(LoadingStore);

  private stompClient: AgendaStompClient | null = null;
  private lastWsDestination: string | null = null;

  readonly isSuperAdmin = computed(() => this.authStore.roles().includes(Role.SUPER_ADMIN));
  readonly isAdmin      = computed(() => this.authStore.roles().includes(Role.ADMIN));
  readonly canManage    = computed(() => this.isAdmin() || this.isSuperAdmin());
  readonly canReadHistoria   = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'leer'));
  readonly canCreateHistoria = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'escribir'));
  readonly canModifyHistoria = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'modificar'));
  readonly canViewAllCitas   = computed(() =>
    this.canManage() || this.authStore.hasAccess('CITA_VER_TODAS', 'leer')
  );

  readonly canBookEmergency = computed(() =>
    this.authStore.hasAccess('VISTA_CITAS_AGENDA', 'escribir')
  );

  readonly empresaSinHorario = computed(() => {
    const vetId = this.citaForm?.get('veterinarioId')?.value;
    if (!vetId) return false;
    return this.horariosActivos.length === 0;
  });

  readonly totalCita = computed(() => {
    const cita = this.citaParaPago();
    if (!cita?.servicioId) return 0;
    return this.servicios().find(s => s.value === cita.servicioId)?.precio ?? 0;
  });

  readonly cambio = computed(() => {
    if (this.metodoPago() !== 'EFECTIVO') return 0;
    const recibido = this.montoRecibido() ?? 0;
    const total = this.totalCita();
    return recibido > total ? recibido - total : 0;
  });

  readonly saldoPendiente = computed(() => {
    if (this.metodoPago() !== 'EFECTIVO') return 0;
    const recibido = this.montoRecibido() ?? 0;
    const total = this.totalCita();
    return recibido < total ? total - recibido : 0;
  });

  readonly esPagoValido = computed(() => {
    if (this.metodoPago() !== 'EFECTIVO') return true;
    const recibido = this.montoRecibido() ?? 0;
    return recibido > 0;
  });

  readonly pagoInsuficienteParaAtencion = computed(() => false);

  citas            = signal<CitaResponse[]>([]);
  private loadTimeout: any = null;
  private lastLazyEvent: any = { first: 0, rows: 10 };
  private suppressSseToast = false;
  totalRecords     = signal<number>(0);
  displayModal     = signal<boolean>(false);
  displayCancelModal = signal<boolean>(false);
  displayDeleteModal = signal<boolean>(false);
  displayDetalleCita = signal<boolean>(false);
  citaDetalle        = signal<CitaResponse | null>(null);
  displayCajaModal   = signal<boolean>(false);
  citaParaPago       = signal<CitaResponse | null>(null);
  metodoPago         = signal<MetodoPago>('EFECTIVO');
  montoRecibido      = signal<number | null>(null);
  yapePhone          = signal<string>('');
  yapeOtp            = signal<string>('');
  yapeEmail          = signal<string>('');

  onYapePhoneChange(val: string) { this.yapePhone.set(val.replace(/\D/g, '').slice(0, 9)); }
  onYapeOtpChange(val: string)   { this.yapeOtp.set(val.replace(/\D/g, '').slice(0, 6)); }
  cancelMotivo     = signal<string>('');
  cancelMotivoAttempted = signal<boolean>(false);
  selectedCita     = signal<CitaResponse | null>(null);
  selectedCitaToDelete = signal<CitaResponse | null>(null);
  isReprogramando  = signal<boolean>(false);
  
  veterinarios     = signal<{ label: string; value: number }[]>([]);
  clientes         = signal<{ label: string; value: number }[]>([]);
  allMascotas      = signal<MascotaResponse[]>([]);
  filteredMascotas = signal<{ label: string; value: number }[]>([]);
  empresas         = signal<{ label: string; value: number }[]>([]);
  horariosVeterinario = signal<HorarioEmpleadoResponse[]>([]);
  availableSlots      = signal<string[]>([]);
  loadingSlots        = signal<boolean>(false);
  servicios            = signal<{ label: string; value: number; precio: number }[]>([]);
  serviciosConDetalle  = signal<ServicioResponse[]>([]);
  todosEmpleados       = signal<{ id: number; nombre: string; apellido: string; tiposEmpleado: string[] }[]>([]);
  selectedServicioId   = signal<number | null>(null);
  empleadosDelServicio = signal<{ label: string; value: number }[]>([]);

  showClienteSelector = signal<boolean>(false);
  clienteSearch       = signal<string>('');
  filteredClientes    = computed(() => {
    const search = this.clienteSearch().toLowerCase();
    return this.clientes().filter(c => c.label.toLowerCase().includes(search));
  });

  selectedClienteLabel = signal<string>('Seleccionar dueño...');
  selectedClienteId    = signal<number | null>(null);
  selectedMascotaLabel = signal<string>('Seleccionar mascota...');
  showMascotaSelector  = signal<boolean>(false);
  showVeterinarioSelector = signal<boolean>(false);
  showServicioSelector = signal<boolean>(false);
  showEstadoFilter = signal<boolean>(false);
  showVeterinarioFilter = signal<boolean>(false);

  @HostListener('document:click')
  closeAllDropdowns() {
    this.showEstadoFilter.set(false);
    this.showVeterinarioFilter.set(false);
    this.showVeterinarioSelector.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeAllDropdowns();
  }

  showNuevoCliente   = signal(false);
  savingNuevoCliente = signal(false);
  ncNombre    = signal('');
  ncApellido  = signal('');
  ncTelefono  = signal('');
  ncCorreo    = signal('');
  ncTipoDoc   = signal('DNI');
  ncNumDoc    = signal('');
  ncGenero    = signal('MASCULINO');

  showNuevaMascota   = signal(false);
  savingNuevaMascota = signal(false);
  nmNombre    = signal('');
  nmEspecie   = signal('PERRO');
  nmRazaId    = signal<number | null>(null);
  nmSexo      = signal('MACHO');
  nmFechaNac  = signal('');
  razasAgenda = signal<RazaResponse[]>([]);
  today: Date                     = new Date();
  filterFecha: string             = this.toDateStr(new Date());
  filterEstado: EstadoCita | null = null;
  filterVeterinarioId: number | null = null;
  filtersOpen                        = false;

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }
  vistaActual  = signal<Vista>('lista');
  fechaBase    = signal<Date>(new Date());
  citasPorDia  = signal<Record<string, CitaResponse[]>>({});
  calendarEvents = signal<EventInput[]>([]);
  cargandoCal  = signal<boolean>(false);
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridDay',
    initialDate: new Date(),
    locale: 'es',
    height: 'auto',
    allDaySlot: false,
    nowIndicator: true,
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: false,
    headerToolbar: false,
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',
    slotDuration: '00:20:00',
    slotLabelInterval: '01:00',
    expandRows: true,
    stickyHeaderDates: true,
    dayMaxEvents: 3,
    moreLinkClassNames: 'agenda-more-link',
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    events: [],
    eventContent: (info) => this.renderCalendarEvent(info),
    eventClick: (info) => {
      const cita = info.event.extendedProps['cita'] as CitaResponse | undefined;
      if (cita) this.verDetalleCita(cita);
    },
    eventAllow: (dropInfo) => !this.isPastDateTime(dropInfo.start),
    eventDrop: (info) => this.onCalendarEventDrop(info)
  };

  readonly HORAS_DIA = Array.from({ length: 15 }, (_, i) => i + 7);

  getVeterinarioLabel(): string {
    const id = this.citaForm.get('veterinarioId')?.value;
    if (!id) return 'Seleccionar empleado...';
    return this.empleadosDelServicio().find(e => e.value === id)?.label ?? 'Seleccionar empleado...';
  }

  getServicioLabel(): string {
    const id = this.citaForm.get('servicioId')?.value;
    return this.servicios().find(s => s.value === id)?.label ?? 'Seleccionar servicio...';
  }

  getEstadoLabel(): string {
    if (!this.filterEstado) return 'Todos';
    return this.estadoOpciones.find(e => e.value === this.filterEstado)?.label ?? 'Todos';
  }

  setEstadoFilter(value: EstadoCita | null) {
    this.filterEstado = value;
    this.showEstadoFilter.set(false);
    this.refreshCurrentView();
  }

  getVeterinarioFilterLabel(): string {
    if (!this.filterVeterinarioId) return 'Todos';
    return this.veterinarios().find(v => v.value === this.filterVeterinarioId)?.label ?? 'Todos';
  }

  setVeterinarioFilter(value: number | null) {
    this.filterVeterinarioId = value;
    this.showVeterinarioFilter.set(false);
    this.refreshCurrentView();
  }

  readonly diasSemanaActual = computed<Date[]>(() => {
    const base = new Date(this.fechaBase());
    const dow  = base.getDay();
    const lunes = new Date(base);
    lunes.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d;
    });
  });

  readonly diasMesActual = computed<Date[]>(() => {
    const base  = this.fechaBase();
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const off   = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const start = new Date(first); start.setDate(1 - off);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
  });

  readonly estadoOpciones = [
    { label: 'Programada',     value: EstadoCita.PROGRAMADA     },
    { label: 'Pendiente',      value: EstadoCita.PENDIENTE      },
    { label: 'Confirmada',     value: EstadoCita.CONFIRMADA     },
    { label: 'Reprogramada',   value: EstadoCita.REPROGRAMADA   },
    { label: 'Sala de espera', value: EstadoCita.SALA_DE_ESPERA },
    { label: 'En proceso',     value: EstadoCita.EN_PROCESO     },
    { label: 'Completada',     value: EstadoCita.COMPLETADA     },
    { label: 'No asistió',     value: EstadoCita.NO_ASISTIO     },
    { label: 'Cancelada',      value: EstadoCita.CANCELADA      },
    { label: 'Otro',           value: EstadoCita.OTRO           },
  ];

  horariosValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const esEmergencia = control.parent?.get('esEmergencia')?.value;
    if (esEmergencia) return null;
    
    const fecha = typeof control.value === 'string' ? new Date(control.value) : control.value as Date;
    return this.isTimeInHorario(fecha) ? null : { 'fuera-de-horario': true };
  };

  citaForm: FormGroup = this.fb.group({
    id:              [null],
    version:         [null],
    mascotaId:       [null, [Validators.required]],
    veterinarioId:   [null, [Validators.required]],
    motivoCita:      ['',   [Validators.required, Validators.minLength(5), Validators.maxLength(250)]],
    fechaHoraInicio: [null, [Validators.required, this.horariosValidator]],
    fechaCita:       [null],
    horaCita:        [null],
    servicioId:      [null, [Validators.required]],
    notas:           ['', [Validators.maxLength(500)]],
    esEmergencia:    [false]
  });

  ngOnInit() {
    this.loadCitas();
    this.loadServicios();
    this.loadVeterinarios();
    this.loadTodosEmpleados();
    this.loadClientes();
    this.loadAllMascotas();
    this.citaForm.get('esEmergencia')?.valueChanges.subscribe((isEmergencia: boolean) => {
      if (isEmergencia) {
        const now = new Date();
        const dateStr = this.toDateStr(now);
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        this.citaForm.patchValue({ fechaCita: dateStr, horaCita: `${hours}:${mins}` });
        this.availableSlots.set([]);
      } else {
        this.citaForm.patchValue({ horaCita: null });
        this.onBookingParamsChange();
      }
      this.citaForm.get('fechaHoraInicio')?.updateValueAndValidity();
    });
    this.setupWebSocket();
  }

  ngOnDestroy() {
    this.stompClient?.disconnect();
  }

  setupWebSocket() {
    const companyId = this.activeCompanyId;
    if (!companyId) return;

    const destination = `/topic/citas/${companyId}`;
    if (this.lastWsDestination === destination && this.stompClient?.isConnected()) return;
    if (this.stompClient) this.stompClient.disconnect();
    this.lastWsDestination = destination;

    try {
      const urlObj = new URL(environment.apiUrl);
      const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      let path = urlObj.pathname.trim();
      if (path.endsWith('/')) path = path.slice(0, -1);
      const wsUrl = `${wsProtocol}//${urlObj.host}${path}/ws/websocket`;

      this.stompClient = new AgendaStompClient(wsUrl);
      this.stompClient.connect(
        () => {
          this.stompClient?.subscribe(destination, (event: CitaWsEvent) => {
            this.handleCitaWsEvent(event);
          });
        },
        (err) => console.error('[Agenda WS] Error:', err)
      );
    } catch (e) {
      console.error('[Agenda WS] Init error:', e);
    }
  }

  private handleCitaWsEvent(event: CitaWsEvent) {
    if (this.suppressSseToast) {
      this.suppressSseToast = false;
      return;
    }
    const mensajes: Record<string, { detail: string; severity: string }> = {
      'CREAR_CITA':      { detail: `Nueva cita programada para ${event.cita?.mascotaNombre ?? ''}`,      severity: 'success' },
      'REPROGRAMAR_CITA':{ detail: `Cita reprogramada — ${event.cita?.mascotaNombre ?? ''}`,             severity: 'warn'    },
      'CANCELAR_CITA':   { detail: `Cita cancelada — ${event.cita?.mascotaNombre ?? ''}`,                severity: 'error'   },
      'ACTUALIZAR_CITA': { detail: `Cita actualizada — ${event.cita?.mascotaNombre ?? ''}`,              severity: 'info'    },
      'INICIAR_ATENCION':{ detail: `Atención iniciada — ${event.cita?.mascotaNombre ?? ''}`,             severity: 'info'    },
      'ELIMINAR_CITA':   { detail: `Cita eliminada — ${event.cita?.mascotaNombre ?? ''}`,                severity: 'warn'    },
    };
    const msg = mensajes[event.tipo] ?? { detail: 'Agenda actualizada', severity: 'info' };
    this.messageService.add({ severity: msg.severity, summary: 'Agenda en tiempo real', detail: msg.detail, life: 5000 });
    this.loadCitas();
    if (this.vistaActual() !== 'lista') this.loadCitasCalendario();
  }

  loadCitas(event: any = null) {
    if (event) {
      this.lastLazyEvent = event;
    }

    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }

    this.loadTimeout = setTimeout(() => {
      this.executeLoadCitas();
    }, 50);
  }

  private executeLoadCitas() {
    const event = this.lastLazyEvent;
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.citas.set([]);
      this.totalRecords.set(0);
      return;
    }

    const page      = Math.floor(event.first / event.rows);
    const fechaStr  = this.filterFecha || undefined;
    const veterinarioId = this.getEffectiveVeterinarioFilter();

    this.loadingStore.show();
    this.citaService.listar(
      companyId,
      fechaStr,
      this.filterEstado    || undefined,
      veterinarioId,
      page,
      event.rows
    ).subscribe({
      next: (res) => {
        this.citas.set(res.data.content);
        this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        // Sincronizar citasPorDia para que la vista 'día' muestre las citas correctamente
        if (this.vistaActual() === 'dia' && this.filterFecha) {
          const mapa: Record<string, CitaResponse[]> = {};
          mapa[this.filterFecha] = res.data.content;
          this.citasPorDia.set(mapa);
          const [y, m, d] = this.filterFecha.split('-').map(Number);
          this.fechaBase.set(new Date(y, m - 1, d));
        }
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las citas' });
        this.loadingStore.hide();
      }
    });
  }

  loadVeterinarios(companyId?: number) {
    const targetCompanyId = companyId || (this.activeCompanyId ?? undefined);
    this.empleadoService.listar(targetCompanyId, undefined, 0, 100).subscribe({
      next: (res) => {
        this.veterinarios.set(
          res.data.content
            .map((e: any) => ({ label: `${e.nombre} ${e.apellido}`, value: e.id }))
        );
      }
    });
  }

  loadClientes(companyId?: number) {
    const targetCompanyId = companyId || (this.activeCompanyId ?? undefined);
    this.apoderadoService.listar(targetCompanyId, undefined, undefined, 0, 100).subscribe({
      next: (res) => {
        this.clientes.set(
          res.data.content
            .filter(c => c.activo)
            .map(c => ({ label: `${c.nombre} ${c.apellido}`, value: c.id }))
        );
      }
    });
  }

  loadAllMascotas(companyId?: number) {
    const targetCompanyId = companyId || (this.activeCompanyId ?? undefined);
    this.mascotaService.listar(targetCompanyId, undefined, undefined, 0, 500).subscribe({
      next: (res) => this.allMascotas.set(res.data.content)
    });
  }

  loadServicios(companyId?: number) {
    const targetCompanyId = companyId ?? (this.activeCompanyId ?? undefined);
    this.servicioService.listarDisponibles(targetCompanyId).subscribe({
      next: (res) => {
        this.serviciosConDetalle.set(res.data);
        this.servicios.set(
          res.data.map((s: ServicioResponse) => ({
            label: `${s.nombre} — S/ ${s.precio.toFixed(2)}`,
            value: s.id,
            precio: s.precio
          }))
        );
      },
      error: () => this.servicios.set([])
    });
  }

  loadTodosEmpleados(companyId?: number) {
    const cid = companyId ?? (this.activeCompanyId ?? undefined);
    this.empleadoService.listar(cid, undefined, 0, 200).subscribe({
      next: (res) => this.todosEmpleados.set(
        res.data.content
          .filter((e: any) => e.activo)
          .map((e: any) => ({ id: e.id, nombre: e.nombre, apellido: e.apellido, tiposEmpleado: e.tiposEmpleado ?? [] }))
      )
    });
  }

  onClienteChange(cliente: {label: string, value: number}) {
    this.selectedClienteLabel.set(cliente.label);
    this.selectedClienteId.set(cliente.value);
    this.showClienteSelector.set(false);
    this.filteredMascotas.set(
      this.allMascotas()
        .filter(m => m.apoderadoId === cliente.value && m.activo)
        .map(m => ({ label: m.nombreCompleto, value: m.id }))
    );
    this.citaForm.get('mascotaId')?.setValue(null);
    this.selectedMascotaLabel.set('Seleccionar mascota...');
  }

  selectMascota(mascota: {label: string, value: number}) {
    this.selectedMascotaLabel.set(mascota.label);
    this.citaForm.get('mascotaId')?.setValue(mascota.value);
    this.showMascotaSelector.set(false);
  }

  selectVeterinario(vet: {label: string, value: number}) {
    this.citaForm.get('veterinarioId')?.setValue(vet.value);
    this.showVeterinarioSelector.set(false);
    this.onVeterinarioChange(vet.value);
    this.onBookingParamsChange();
  }

  selectServicio(srv: { label: string; value: number } | null) {
    this.citaForm.get('servicioId')?.setValue(srv?.value ?? null);
    this.selectedServicioId.set(srv?.value ?? null);
    this.citaForm.get('veterinarioId')?.setValue(null);
    this.horariosVeterinario.set([]);
    this.availableSlots.set([]);
    this.citaForm.get('horaCita')?.setValue(null);
    this.showServicioSelector.set(false);
    this.filterEmpleadosByServicio(srv?.value ?? null);
    this.onBookingParamsChange();
  }

  private filterEmpleadosByServicio(servicioId: number | null) {
    if (!servicioId) { this.empleadosDelServicio.set([]); return; }
    const servicio = this.serviciosConDetalle().find(s => s.id === servicioId);
    const todos = this.todosEmpleados();
    if (!servicio?.tipoEmpleadoNombre) {
      this.empleadosDelServicio.set(todos.map(e => ({ label: `${e.nombre} ${e.apellido}`, value: e.id })));
      return;
    }
    const tipoTarget = servicio.tipoEmpleadoNombre.toUpperCase().trim();
    const filtered = todos.filter(e =>
      e.tiposEmpleado.some(t => t.toUpperCase().trim() === tipoTarget)
    );
    this.empleadosDelServicio.set(filtered.map(e => ({ label: `${e.nombre} ${e.apellido}`, value: e.id })));
  }

  onFechaCitaChange(event: Event) {
    const dateStr = (event.target as HTMLInputElement).value;
    this.citaForm.get('fechaCita')?.setValue(dateStr, { emitEvent: false });
    this.onBookingParamsChange(dateStr);
  }

  onBookingParamsChange(fechaOverride?: string) {
    const val = this.citaForm.value;
    const isEditing = !!val.id && !this.isReprogramando();
    if (isEditing) return;
    const fechaRaw = fechaOverride ?? val.fechaCita;
    if (!val.veterinarioId || !fechaRaw || !val.servicioId) {
      this.availableSlots.set([]);
      this.citaForm.get('horaCita')?.setValue(null);
      return;
    }
    this.loadingSlots.set(true);
    this.availableSlots.set([]);
    this.citaForm.get('horaCita')?.setValue(null);
    let fechaStr: string;
    if (fechaRaw instanceof Date) {
      const y = fechaRaw.getFullYear();
      const m = String(fechaRaw.getMonth() + 1).padStart(2, '0');
      const d = String(fechaRaw.getDate()).padStart(2, '0');
      fechaStr = `${y}-${m}-${d}`;
    } else {
      fechaStr = fechaRaw as string;
    }
    const isEmergencia = val.esEmergencia ?? false;
    const excludeId = this.isReprogramando() ? val.id : undefined;
    this.citaService.getAdminDisponibilidad(val.veterinarioId, fechaStr, val.servicioId, isEmergencia, excludeId).subscribe({
      next: (res) => { this.availableSlots.set(res.data || []); this.loadingSlots.set(false); },
      error: ()   => { this.availableSlots.set([]); this.loadingSlots.set(false); }
    });
  }

  selectTimeSlot(slot: string) {
    this.citaForm.get('horaCita')?.setValue(slot);
  }

  agendarEmergencia() {
    this.citaForm.get('esEmergencia')?.setValue(true);
  }

  onVeterinarioChange(veterinarioId: number) {
    if (!veterinarioId) {
      this.horariosVeterinario.set([]);
      this.citaForm.get('fechaHoraInicio')?.clearAsyncValidators();
      return;
    }

    this.empleadoService.getHorario(veterinarioId).subscribe({
      next: (res) => {
        const order = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
        const sorted = res.data.sort((a, b) => order.indexOf(a.diaSemana) - order.indexOf(b.diaSemana));
        this.horariosVeterinario.set(sorted);
        this.citaForm.get('fechaHoraInicio')?.updateValueAndValidity();
      },
      error: () => {
        this.horariosVeterinario.set([]);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el horario del veterinario' });
      }
    });
  }
  isTimeInHorario(fecha: Date): boolean {
    if (!fecha) return false;
    if (this.citaForm.get('esEmergencia')?.value) return true;

    const horarios = this.horariosVeterinario();
    if (horarios.length === 0) return false;

    const dayOfWeek = fecha.getDay();
    const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const diaActual = diasSemana[dayOfWeek];
    const horarioDelDia = horarios.find(h => h.diaSemana === diaActual);
    if (!horarioDelDia) return false;

    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const timeSeleccionada = `${horas}:${minutos}`;

    return timeSeleccionada >= horarioDelDia.horaInicio && timeSeleccionada <= horarioDelDia.horaFin;
  }

  openNew() {
    this.citaForm.reset({ esEmergencia: false, fechaCita: null, horaCita: null });
    this.selectedClienteLabel.set('Seleccionar dueño...');
    this.selectedMascotaLabel.set('Seleccionar mascota...');
    this.filteredMascotas.set([]);
    this.horariosVeterinario.set([]);
    this.availableSlots.set([]);
    this.selectedServicioId.set(null);
    this.isReprogramando.set(false);
    this.selectedClienteId.set(null);
    this.showClienteSelector.set(false);
    this.clienteSearch.set('');
    this.showNuevoCliente.set(false);
    this.ncNombre.set(''); this.ncApellido.set('');
    this.ncTelefono.set(''); this.ncCorreo.set('');
    this.ncTipoDoc.set('DNI'); this.ncNumDoc.set(''); this.ncGenero.set('MASCULINO');
    this.showNuevaMascota.set(false);
    this.nmNombre.set(''); this.nmEspecie.set('PERRO');
    this.nmRazaId.set(null); this.nmSexo.set('MACHO'); this.nmFechaNac.set('');
    this.displayModal.set(true);
  }

  canReprogram(cita: CitaResponse): boolean {
    if (cita.estado !== EstadoCita.PROGRAMADA && 
        cita.estado !== EstadoCita.CANCELADA && 
        cita.estado !== EstadoCita.REPROGRAMADA) {
      return false;
    }
    if (cita.estado === EstadoCita.PROGRAMADA || cita.estado === EstadoCita.REPROGRAMADA) {
      const fechaInicio = new Date(cita.fechaHoraInicio);
      const ahora = new Date();
      const diferenciaMs = fechaInicio.getTime() - ahora.getTime();
      const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
      return diferenciaHoras >= 1;
    }

    return true; 
  }

  reprogramarCita(cita: CitaResponse) {
    this.isReprogramando.set(true);
    this.availableSlots.set([]);
    this.editarCita(cita);
  }

  editarCita(cita: CitaResponse) {
    this.selectedClienteLabel.set(cita.apoderadoNombre);
    this.selectedMascotaLabel.set(cita.mascotaNombre);
    this.filteredMascotas.set(
      this.allMascotas()
        .filter(m => m.apoderadoId === cita.apoderadoId)
        .map(m => ({ label: m.nombreCompleto, value: m.id }))
    );
    this.availableSlots.set([]);
    this.selectedServicioId.set(cita.servicioId ?? null);
    this.filterEmpleadosByServicio(cita.servicioId ?? null);

    const fechaDate = new Date(cita.fechaHoraInicio);
    const fechaStr  = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth()+1).padStart(2,'0')}-${String(fechaDate.getDate()).padStart(2,'0')}`;

    this.citaForm.patchValue({
      id: cita.id,
      version: cita.version,
      mascotaId: cita.mascotaId,
      veterinarioId: cita.veterinarioId,
      motivoCita: cita.motivoCita,
      fechaHoraInicio: cita.fechaHoraInicio.substring(0, 16),
      fechaCita: fechaStr,
      horaCita: cita.fechaHoraInicio.substring(11, 16),
      servicioId: cita.servicioId,
      notas: cita.notas,
      esEmergencia: cita.esEmergencia
    });

    this.onVeterinarioChange(cita.veterinarioId);
    this.onBookingParamsChange();
    this.selectedClienteId.set(cita.apoderadoId);
    this.showClienteSelector.set(false);
    this.clienteSearch.set('');
    this.showNuevoCliente.set(false);
    this.showNuevaMascota.set(false);
    this.displayModal.set(true);
  }

  crearNuevoCliente() {
    const nombre   = this.ncNombre().trim();
    const apellido = this.ncApellido().trim();
    const telefono = this.ncTelefono().trim();
    const correo   = this.ncCorreo().trim();
    const numDoc   = this.ncNumDoc().trim();

    if (!nombre || !apellido || !telefono || !correo || !numDoc) {
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Complete todos los campos del nuevo cliente.' });
      return;
    }

    this.savingNuevoCliente.set(true);
    this.apoderadoService.registrar({
      nombre,
      apellido,
      email: correo,
      telefono,
      tipoDocumento: this.ncTipoDoc(),
      numeroDocumento: numDoc,
      genero: this.ncGenero(),
      companyId: this.activeCompanyId ?? undefined
    }).subscribe({
      next: (res) => {
        const apoderadoId = res.data.apoderadoId ?? res.data.id;
        const nuevoCliente = { label: `${nombre} ${apellido}`, value: apoderadoId };
        this.clientes.update(list => [nuevoCliente, ...list]);
        this.onClienteChange(nuevoCliente);
        this.ncNombre.set(''); this.ncApellido.set('');
        this.ncTelefono.set(''); this.ncCorreo.set('');
        this.ncTipoDoc.set('DNI'); this.ncNumDoc.set(''); this.ncGenero.set('MASCULINO');
        this.showNuevoCliente.set(false);
        this.savingNuevoCliente.set(false);
        this.messageService.add({ severity: 'success', summary: 'Cliente creado', detail: `${nombre} ${apellido} registrado correctamente.` });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear el cliente.' });
        this.savingNuevoCliente.set(false);
      }
    });
  }

  loadRazasAgenda() {
    this.razaService.listarPorEspecie(this.nmEspecie(), this.activeCompanyId ?? undefined).subscribe({
      next: (res) => this.razasAgenda.set(res.data)
    });
  }

  onAgendaEspecieChange(especie: string) {
    this.nmEspecie.set(especie);
    this.loadRazasAgenda();
    this.nmRazaId.set(null);
  }

  toggleNuevaMascota() {
    const willShow = !this.showNuevaMascota();
    this.showNuevaMascota.set(willShow);
    this.showMascotaSelector.set(false);
    if (willShow) {
      this.loadRazasAgenda();
    }
  }

  crearNuevaMascota() {
    const apoderadoId = this.selectedClienteId();
    if (!apoderadoId) {
      this.messageService.add({ severity: 'warn', summary: 'Sin dueño', detail: 'Selecciona o crea un cliente primero.' });
      return;
    }
    const nombre = this.nmNombre().trim();
    const razaId = this.nmRazaId();
    const fecha  = this.nmFechaNac().trim();
    if (!nombre || !razaId || !fecha) {
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Complete nombre, raza y fecha de nacimiento.' });
      return;
    }
    if (fecha > this.toDateStr(this.today)) {
      this.messageService.add({ severity: 'warn', summary: 'Fecha inválida', detail: 'La fecha de nacimiento no puede ser futura.' });
      return;
    }

    this.savingNuevaMascota.set(true);
    this.mascotaService.crear({
      nombreCompleto: nombre,
      especie: this.nmEspecie(),
      razaId,
      sexo: this.nmSexo(),
      fechaNacimiento: fecha,
      apoderadoId
    }).subscribe({
      next: (res) => {
        const mascota = res.data;
        this.allMascotas.update(list => [mascota, ...list]);
        const item = { label: mascota.nombreCompleto, value: mascota.id };
        this.filteredMascotas.update(list => [item, ...list]);
        this.selectMascota(item);
        this.nmNombre.set(''); this.nmEspecie.set('PERRO');
        this.nmRazaId.set(null); this.nmSexo.set('MACHO'); this.nmFechaNac.set('');
        this.showNuevaMascota.set(false);
        this.savingNuevaMascota.set(false);
        this.messageService.add({ severity: 'success', summary: 'Mascota registrada', detail: `${nombre} registrado correctamente.` });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar la mascota.' });
        this.savingNuevaMascota.set(false);
      }
    });
  }

  saveCita() {
    const formValue = this.citaForm.value;
    const isEditing = !!formValue.id && !this.isReprogramando();

    // Para nueva cita o reprogramación: validar fecha + slot
    if (!isEditing) {
      if (!formValue.mascotaId || !formValue.veterinarioId || !formValue.servicioId || !formValue.motivoCita || !formValue.fechaCita || !formValue.horaCita) {
        this.citaForm.markAllAsTouched();
        this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Complete todos los campos obligatorios y seleccione un horario.' });
        return;
      }
    } else {
      if (this.citaForm.invalid) {
        this.citaForm.markAllAsTouched();
        return;
      }
    }

    let localIsoString: string;
    if (!isEditing) {
      let dateStr: string;
      if (formValue.fechaCita instanceof Date) {
        const y = formValue.fechaCita.getFullYear();
        const m = String(formValue.fechaCita.getMonth() + 1).padStart(2, '0');
        const d = String(formValue.fechaCita.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      } else {
        dateStr = formValue.fechaCita as string;
      }
      localIsoString = `${dateStr}T${formValue.horaCita}:00`;
    } else {
      localIsoString = formValue.fechaHoraInicio;
      if (formValue.fechaHoraInicio instanceof Date) {
        const date = formValue.fechaHoraInicio;
        localIsoString = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:00`;
      }
    }

    if (this.isPastDateTime(new Date(localIsoString))) {
      this.messageService.add({ severity: 'warn', summary: 'Fecha invalida', detail: 'La fecha de la cita no puede estar en el pasado.' });
      return;
    }

    const request: CitaRequest = {
      ...formValue,
      fechaHoraInicio: localIsoString
    };
    
    const id = this.citaForm.get('id')?.value;
    const observer = {
      next: () => {
        this.suppressSseToast = true;
        this.messageService.add({
          severity: 'success',
          summary: 'Listo',
          detail: id ? 'Cita actualizada' : 'Cita programada'
        });
        this.displayModal.set(false);
        this.loadCitas();
        this.loadingStore.hide();
      },
      error: (err: any) => {
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: err.error?.message || 'Error al procesar la cita' 
        });
        this.loadingStore.hide();
      }
    };

    if (this.isReprogramando()) {
      this.confirmationService.confirm({
        message: '¿Está seguro de que desea reprogramar esta cita? El estado cambiará a REPROGRAMADA.',
        header: 'Confirmar Reprogramación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, reprogramar',
        rejectLabel: 'No, volver',
        accept: () => {
          this.loadingStore.show();
          this.citaService.reprogramar(id, request).subscribe(observer);
        },
        reject: () => {
        }
      });
    } else if (id) {
      this.loadingStore.show();
      this.citaService.actualizar(id, request).subscribe(observer);
    } else {
      this.loadingStore.show();
      this.citaService.crear(request).subscribe(observer);
    }
  }

  canCancel(cita: CitaResponse): boolean {
    if (cita.estado === EstadoCita.COMPLETADA || cita.estado === EstadoCita.CANCELADA || cita.estado === EstadoCita.EN_PROCESO || cita.estado === EstadoCita.ELIMINADA) {
      return false;
    }
    const fechaInicio = new Date(cita.fechaHoraInicio);
    const ahora = new Date();
    const diferenciaMs = fechaInicio.getTime() - ahora.getTime();
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    
    return diferenciaHoras >= 1;
  }

  canEdit(cita: CitaResponse): boolean {
    if (cita.estado === EstadoCita.COMPLETADA || cita.estado === EstadoCita.CANCELADA || cita.estado === EstadoCita.EN_PROCESO || cita.estado === EstadoCita.ELIMINADA) {
      return false;
    }
    const fechaInicio = new Date(cita.fechaHoraInicio);
    const ahora = new Date();
    const diferenciaMs = fechaInicio.getTime() - ahora.getTime();
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    
    return diferenciaHoras >= 1;
  }

  citaActionItems(cita: CitaResponse): MenuItem[] {
    const canModifyCita = this.authStore.hasAccess('VISTA_CITAS_AGENDA', 'modificar');
    const canDeleteCita = this.authStore.hasAccess('VISTA_CITAS_AGENDA', 'eliminar');
    const items: MenuItem[] = [
      {
        label: 'Ver detalle',
        icon: 'pi pi-eye',
        command: () => this.verDetalleCita(cita)
      }
    ];

    if (this.canEdit(cita) && canModifyCita) {
      items.push({ label: 'Editar', icon: 'pi pi-pencil', command: () => this.editarCita(cita) });
    }

    if (this.canReprogram(cita) && canModifyCita) {
      items.push({ label: 'Reprogramar', icon: 'pi pi-calendar-plus', command: () => this.reprogramarCita(cita) });
    }

    if (this.canCreateHistoria() && (cita.estado === 'PROGRAMADA' || cita.estado === 'CONFIRMADA' || cita.estado === 'SALA_DE_ESPERA' || cita.estado === 'REPROGRAMADA')) {
      items.push({ label: 'Iniciar consulta', icon: 'pi pi-play', command: () => this.iniciarCita(cita) });
    }

    if (this.canReadHistoria() && cita.estado === 'EN_PROCESO') {
      items.push({ label: 'Continuar consulta', icon: 'pi pi-eye', command: () => this.continuarConsulta(cita) });
    }

    if (this.canReadHistoria() && (cita.estado === 'COMPLETADA' || cita.consultaId) && cita.estado !== 'EN_PROCESO') {
      items.push({ label: 'Ver consulta', icon: 'pi pi-file-edit', command: () => this.continuarConsulta(cita) });
    }

    if (this.canCobrar(cita)) {
      items.push({ label: 'Cobrar', icon: 'pi pi-wallet', command: () => this.abrirCaja(cita) });
    }

    if (this.canCancel(cita) && canModifyCita) {
      items.push({ label: 'Cancelar', icon: 'pi pi-times', command: () => this.cancelarCita(cita) });
    }

    if (cita.estado === 'CANCELADA' && canDeleteCita) {
      items.push({ label: 'Eliminar', icon: 'pi pi-trash', command: () => this.eliminarCita(cita) });
    }

    return items;
  }

  verDetalleCita(cita: CitaResponse) {
    this.citaDetalle.set(cita);
    this.displayDetalleCita.set(true);
  }

  iniciarCita(cita: CitaResponse) {
    if (!this.canCreateHistoria()) {
      this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No puedes iniciar historias clÃ­nicas.' });
      return;
    }
    this.displayDetalleCita.set(false);
    this.loadingStore.show();
    this.citaService.iniciarAtencion(cita.id).subscribe({
      next: (res) => {
        this.suppressSseToast = true;
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Atención iniciada' });
        this.loadingStore.hide();
        if (res.data) {
          this.router.navigate(['/historias-clinicas/consulta', res.data], { queryParams: { returnUrl: '/citas/agenda' } });
        } else {
          this.loadCitas();
        }
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al iniciar atención' });
        this.loadingStore.hide();
      }
    });
  }

  cancelarCita(cita: CitaResponse) {
    this.displayDetalleCita.set(false);
    if (!this.canCancel(cita)) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Restricción', 
        detail: 'No se puede cancelar la cita.' 
      });
      return;
    }

    this.confirmationService.confirm({
      message: '¿Está seguro de que desea cancelar esta cita? El apoderado y el profesional recibirán notificaciones de cancelación.',
      header: 'Confirmar Cancelación de Cita',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cancelar',
      rejectLabel: 'No, volver',
      accept: () => {
        this.loadingStore.show();
        this.citaService.cancelarCita(cita.id, '').subscribe({
          next: () => {
            this.suppressSseToast = true;
            this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Cita cancelada correctamente.' });
            this.loadCitas();
            if (this.vistaActual() !== 'lista') this.loadCitasCalendario();
            this.loadingStore.hide();
            if ((cita.montoPagado ?? 0) > 0) {
              setTimeout(() => {
                this.confirmationService.confirm({
                  message: `Esta cita tenía S/ ${(cita.montoPagado ?? 0).toFixed(2)} pagado. ¿Registrar la devolución en caja?`,
                  header: 'Devolución de pago',
                  icon: 'pi pi-wallet',
                  acceptLabel: 'Sí, registrar devolución',
                  rejectLabel: 'No, omitir',
                  accept: () => this.registrarDevolucionCita(cita)
                });
              }, 400);
            }
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cancelar la cita' });
            this.loadingStore.hide();
          }
        });
      }
    });
  }

  private registrarDevolucionCita(cita: CitaResponse) {
    this.cajaService.registrarDevolucion(cita.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Devolución registrada', detail: `Se registró la devolución de S/ ${(cita.montoPagado ?? 0).toFixed(2)} en caja.` });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo registrar la devolución.' });
      }
    });
  }

  eliminarCita(cita: CitaResponse) {
    this.displayDetalleCita.set(false);
    if (cita.estado !== EstadoCita.CANCELADA) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Aviso', 
        detail: 'Solo se pueden eliminar citas previamente canceladas' 
      });
      return;
    }

    this.selectedCitaToDelete.set(cita);
    this.displayDeleteModal.set(true);
  }

  confirmarEliminar() {
    const cita = this.selectedCitaToDelete();
    if (!cita) return;

    this.loadingStore.show();
    this.citaService.eliminarCita(cita.id).subscribe({
      next: () => {
        this.suppressSseToast = true;
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Cita eliminada correctamente' });
        this.displayDeleteModal.set(false);
        this.loadCitas();
        if (this.vistaActual() !== 'lista') this.loadCitasCalendario();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: err.error?.message || 'No se pudo eliminar la cita' 
        });
        this.loadingStore.hide();
      }
    });
  }

  continuarConsulta(cita: CitaResponse) {
    if (!this.canReadHistoria()) {
      this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No puedes ver historias clÃ­nicas.' });
      return;
    }
    this.displayDetalleCita.set(false);
    if (cita.consultaId) {
      this.router.navigate(['/historias-clinicas/consulta', cita.consultaId], { queryParams: { returnUrl: '/citas/agenda' } });
    } else {
      if (!this.canCreateHistoria()) {
        this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No puedes iniciar historias clÃ­nicas.' });
        return;
      }
      this.loadingStore.show();
      this.citaService.iniciarAtencion(cita.id).subscribe({
        next: (res) => {
          this.loadingStore.hide();
          if (res.data) {
            this.router.navigate(['/historias-clinicas/consulta', res.data], { queryParams: { returnUrl: '/citas/agenda' } });
          } else {
            this.loadCitas();
          }
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo recuperar la consulta activa' });
          this.loadingStore.hide();
        }
      });
    }
  }

  estadoLabel(estado: EstadoCita): string {
    const labels: Record<EstadoCita, string> = {
      [EstadoCita.PROGRAMADA]:     'Programada',
      [EstadoCita.PENDIENTE]:      'Pendiente',
      [EstadoCita.CONFIRMADA]:     'Confirmada',
      [EstadoCita.REPROGRAMADA]:   'Reprogramada',
      [EstadoCita.SALA_DE_ESPERA]: 'Sala de espera',
      [EstadoCita.EN_PROCESO]:     'En proceso',
      [EstadoCita.COMPLETADA]:     'Completada',
      [EstadoCita.NO_ASISTIO]:     'No asistió',
      [EstadoCita.CANCELADA]:      'Cancelada',
      [EstadoCita.ELIMINADA]:      'Eliminada',
      [EstadoCita.OTRO]:           'Otro',
    };
    return labels[estado] ?? estado;
  }

  estadoClass(estado: EstadoCita): string {
    switch (estado) {
      case EstadoCita.PROGRAMADA:     return 'bg-sky-50 text-sky-700';
      case EstadoCita.PENDIENTE:      return 'bg-yellow-50 text-yellow-700';
      case EstadoCita.CONFIRMADA:     return 'bg-blue-50 text-blue-700';
      case EstadoCita.REPROGRAMADA:   return 'bg-orange-50 text-orange-700';
      case EstadoCita.SALA_DE_ESPERA: return 'bg-violet-50 text-violet-700';
      case EstadoCita.EN_PROCESO:     return 'bg-amber-50 text-amber-700';
      case EstadoCita.COMPLETADA:     return 'bg-emerald-50 text-emerald-700';
      case EstadoCita.NO_ASISTIO:     return 'bg-slate-100 text-slate-500';
      case EstadoCita.CANCELADA:      return 'bg-rose-50 text-rose-700';
      case EstadoCita.ELIMINADA:      return 'bg-red-50 text-red-700';
      default:                        return 'bg-slate-100 text-slate-500';
    }
  }

  estadoColor(estado: EstadoCita): string {
    switch (estado) {
      case EstadoCita.PROGRAMADA:     return 'bg-sky-400';
      case EstadoCita.CONFIRMADA:     return 'bg-blue-500';
      case EstadoCita.SALA_DE_ESPERA: return 'bg-violet-500';
      case EstadoCita.EN_PROCESO:     return 'bg-amber-500';
      case EstadoCita.COMPLETADA:     return 'bg-emerald-500';
      case EstadoCita.CANCELADA:      return 'bg-rose-400';
      case EstadoCita.ELIMINADA:      return 'bg-red-400';
      default:                        return 'bg-slate-400';
    }
  }

  estadoAvatarClass(estado: EstadoCita): string {
    switch (estado) {
      case EstadoCita.PROGRAMADA:     return 'bg-sky-100 text-sky-700';
      case EstadoCita.PENDIENTE:      return 'bg-yellow-100 text-yellow-700';
      case EstadoCita.CONFIRMADA:     return 'bg-blue-100 text-blue-700';
      case EstadoCita.REPROGRAMADA:   return 'bg-orange-100 text-orange-700';
      case EstadoCita.SALA_DE_ESPERA: return 'bg-violet-100 text-violet-700';
      case EstadoCita.EN_PROCESO:     return 'bg-amber-100 text-amber-700';
      case EstadoCita.COMPLETADA:     return 'bg-emerald-100 text-emerald-700';
      case EstadoCita.CANCELADA:      return 'bg-rose-100 text-rose-600';
      case EstadoCita.ELIMINADA:      return 'bg-red-100 text-red-600';
      default:                        return 'bg-slate-100 text-slate-600';
    }
  }

  cambiarVista(vista: Vista) {
    this.vistaActual.set(vista);
    if (vista === 'lista') {
      this.loadCitas();
    } else {
      this.setFullCalendarView(vista);
      this.loadCitasCalendario();
    }
  }

  navegarCalendario(dir: -1 | 1) {
    const base = new Date(this.fechaBase());
    const v = this.vistaActual();
    if (v === 'dia') {
      base.setDate(base.getDate() + dir);
      this.filterFecha = this.toDateStr(base);
      this.fechaBase.set(base);
      this.loadCitasCalendario();
    } else if (v === 'semana') {
      base.setDate(base.getDate() + dir * 7);
      this.fechaBase.set(base);
      this.loadCitasCalendario();
    } else {
      base.setMonth(base.getMonth() + dir);
      this.fechaBase.set(base);
      this.loadCitasCalendario();
    }
  }

  irAHoy() {
    const hoy = new Date();
    this.fechaBase.set(hoy);
    this.filterFecha = this.toDateStr(hoy);
    if (this.vistaActual() === 'lista') {
      this.loadCitas();
    } else {
      this.loadCitasCalendario();
    }
  }

  onFilterFechaChange() {
    if (this.filterFecha) {
      const [y, m, d] = this.filterFecha.split('-').map(Number);
      this.fechaBase.set(new Date(y, m - 1, d));
    }
    this.refreshCurrentView();
  }

  refreshCurrentView() {
    if (this.vistaActual() === 'lista') {
      this.loadCitas();
    } else {
      this.loadCitasCalendario();
    }
  }

  loadCitasCalendario() {
    const companyId = this.activeCompanyId ?? undefined;
    if (!companyId) { this.citasPorDia.set({}); return; }
    const veterinarioId = this.getEffectiveVeterinarioFilter();

    this.cargandoCal.set(true);

    if (this.vistaActual() === 'dia') {
      const fecha = this.toDateStr(this.fechaBase());
      this.citaService.listar(companyId, fecha, this.filterEstado || undefined, veterinarioId, 0, 50).pipe(
        map(res => ({ fecha, citas: res.data.content })),
        catchError(() => of({ fecha, citas: [] as CitaResponse[] }))
      ).subscribe(({ fecha, citas }) => {
        this.citasPorDia.set({ [fecha]: citas });
        this.calendarEvents.set(this.toCalendarEvents(citas));
        this.syncFullCalendar();
        this.cargandoCal.set(false);
      });
      return;
    }

    // Semana / Mes: una sola llamada sin filtro de fecha, se agrupa en frontend
    const maxSize = this.vistaActual() === 'semana' ? 100 : 200;
    this.citaService.listar(companyId, undefined, this.filterEstado || undefined, veterinarioId, 0, maxSize).pipe(
      catchError(() => of({ data: { content: [] as CitaResponse[] } } as any))
    ).subscribe(res => {
      const todas = (res as any).data?.content ?? [];
      const mapa: Record<string, CitaResponse[]> = {};
      for (const c of todas) {
        const d = c.fechaHoraInicio?.substring(0, 10);
        if (d) {
          if (!mapa[d]) mapa[d] = [];
          mapa[d].push(c);
        }
      }
      this.citasPorDia.set(mapa);
      this.calendarEvents.set(this.toCalendarEvents(todas));
      this.syncFullCalendar();
      this.cargandoCal.set(false);
    });
  }

  private getEffectiveVeterinarioFilter(): number | undefined {
    if (this.filterVeterinarioId) return this.filterVeterinarioId;
    const roles = this.authStore.roles();
    const isAdmin = roles.includes('ROLE_SUPER_ADMIN') || roles.includes('SUPER_ADMIN')
                 || roles.includes('ROLE_ADMIN')       || roles.includes('ADMIN');
    if (isAdmin) return undefined;
    if (!this.authStore.hasAccess('CITA_VER_TODAS', 'leer')) {
      return this.authStore.empleadoId() ?? undefined;
    }
    return undefined;
  }

  private setFullCalendarView(vista: Vista) {
    const viewName = vista === 'dia' ? 'timeGridDay' : vista === 'semana' ? 'timeGridWeek' : 'dayGridMonth';
    this.calendarOptions = {
      ...this.calendarOptions,
      initialView: viewName,
      initialDate: this.fechaBase()
    };
    setTimeout(() => {
      const api = this.fullCalendar?.getApi();
      api?.changeView(viewName, this.fechaBase());
    });
  }

  private syncFullCalendar() {
    this.calendarOptions = {
      ...this.calendarOptions,
      initialDate: this.fechaBase(),
      events: this.calendarEvents()
    };
    setTimeout(() => {
      const api = this.fullCalendar?.getApi();
      if (!api) return;
      api.gotoDate(this.fechaBase());
      api.removeAllEvents();
      api.addEventSource(this.calendarEvents());
    });
  }

  private toCalendarEvents(citas: CitaResponse[]): EventInput[] {
    return citas.map(cita => ({
      id: String(cita.id),
      title: cita.mascotaNombre,
      start: cita.fechaHoraInicio,
      end: cita.fechaHoraFin,
      editable: this.canReprogram(cita) && this.authStore.hasAccess('VISTA_CITAS_AGENDA', 'modificar'),
      backgroundColor: this.calendarBgColor(cita.estado),
      textColor: '#1e293b',
      extendedProps: { cita }
    }));
  }

  private renderCalendarEvent(info: EventContentArg) {
    const cita = info.event.extendedProps['cita'] as CitaResponse | undefined;
    const accent = cita ? this.calendarColor(cita.estado) : '#0066AA';
    const timeHtml = info.timeText
      ? `<span class="agenda-event-time" style="color:${accent}">${info.timeText}</span>`
      : '';
    const title   = cita?.mascotaNombre ?? info.event.title;
    const service = cita?.servicioNombre ?? cita?.veterinarioNombre ?? '';
    const estado  = cita ? this.estadoLabel(cita.estado) : '';

    return {
      html: `
        <div class="agenda-event-card">
          <div class="agenda-event-main">
            ${timeHtml}
            <span class="agenda-event-title">${this.escapeHtml(title)}</span>
          </div>
          ${service ? `<span class="agenda-event-service">${this.escapeHtml(service)}</span>` : ''}
          ${estado  ? `<span class="agenda-event-badge" style="color:${accent};border-color:${accent}30;background:${accent}10">${this.escapeHtml(estado)}</span>` : ''}
        </div>
      `
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private onCalendarEventDrop(info: any) {
    const cita = info.event.extendedProps?.cita as CitaResponse | undefined;
    const nuevaFecha = info.event.start as Date | null;

    if (!cita || !nuevaFecha) {
      info.revert();
      return;
    }

    if (!this.canReprogram(cita) || !this.authStore.hasAccess('VISTA_CITAS_AGENDA', 'modificar')) {
      info.revert();
      this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No puedes reprogramar esta cita.' });
      return;
    }

    if (this.isPastDateTime(nuevaFecha)) {
      info.revert();
      this.messageService.add({ severity: 'warn', summary: 'Fecha invalida', detail: 'No puedes reprogramar una cita en una fecha pasada.' });
      return;
    }

    this.loadingStore.show();
    this.citaService.reprogramar(cita.id, {
      veterinarioId: cita.veterinarioId,
      fechaHoraInicio: this.toLocalDateTimeString(nuevaFecha),
      motivoReprogramacion: 'Reprogramado desde agenda'
    }).subscribe({
      next: () => {
        this.suppressSseToast = true;
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Cita reprogramada correctamente.' });
        this.loadCitas();
        this.loadCitasCalendario();
        this.loadingStore.hide();
      },
      error: (err) => {
        info.revert();
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo reprogramar',
          detail: err.error?.message || 'El nuevo horario no está disponible.'
        });
        this.loadingStore.hide();
      }
    });
  }

  private calendarColor(estado: EstadoCita): string {
    const colors: Record<string, string> = {
      PROGRAMADA: '#0066AA',
      PENDIENTE: '#d97706',
      CONFIRMADA: '#059669',
      REPROGRAMADA: '#7c3aed',
      SALA_DE_ESPERA: '#0891b2',
      EN_PROCESO: '#ea580c',
      COMPLETADA: '#16a34a',
      CANCELADA: '#dc2626',
      NO_ASISTIO: '#64748b'
    };
    return colors[estado] ?? '#475569';
  }

  private calendarBgColor(estado: EstadoCita): string {
    const colors: Record<string, string> = {
      PROGRAMADA:    '#e8f4ff',
      PENDIENTE:     '#fffbeb',
      CONFIRMADA:    '#ecfdf5',
      REPROGRAMADA:  '#f5f3ff',
      SALA_DE_ESPERA:'#ecfeff',
      EN_PROCESO:    '#fff7ed',
      COMPLETADA:    '#f0fdf4',
      CANCELADA:     '#fef2f2',
      NO_ASISTIO:    '#f8fafc'
    };
    return colors[estado] ?? '#f8fafc';
  }

  private toLocalDateTimeString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}:00`;
  }

  private isPastDateTime(date: Date): boolean {
    return date.getTime() < Date.now() - 60_000;
  }

  canCobrar(cita: CitaResponse): boolean {
    if (!cita.servicioId) return false;
    if (cita.estado === EstadoCita.CANCELADA || cita.estado === EstadoCita.NO_ASISTIO || cita.estado === EstadoCita.ELIMINADA) return false;
    const total = cita.totalServicio ?? 0;
    const pagado = cita.montoPagado ?? 0;
    return total > 0 && pagado <= 0;
  }

  abrirCaja(cita: CitaResponse) {
    this.displayDetalleCita.set(false);
    this.citaParaPago.set(cita);
    this.metodoPago.set('EFECTIVO');
    this.montoRecibido.set(null);
    this.yapePhone.set('');
    this.yapeOtp.set('');
    this.yapeEmail.set(cita.apoderadoEmail ?? '');
    this.displayCajaModal.set(true);
  }

  confirmarPago() {
    const cita = this.citaParaPago();
    if (!cita) return;

    if (this.metodoPago() === 'EFECTIVO') {
      if (!this.esPagoValido()) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Monto requerido',
          detail: 'Ingrese el monto recibido'
        });
        return;
      }
    }

    if (this.metodoPago() === 'YAPE') {
      const phone = this.yapePhone().trim();
      const otp   = this.yapeOtp().trim();
      const email = this.yapeEmail().trim();
      if (!phone || phone.length !== 9 || !/^\d{9}$/.test(phone)) {
        this.messageService.add({ severity: 'warn', summary: 'Teléfono inválido', detail: 'El número Yape debe tener exactamente 9 dígitos' });
        return;
      }
      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        this.messageService.add({ severity: 'warn', summary: 'OTP inválido', detail: 'El código OTP debe tener exactamente 6 dígitos' });
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.messageService.add({ severity: 'warn', summary: 'Email inválido', detail: 'Ingrese un correo electrónico válido del cliente' });
        return;
      }
    }

    const request: PagoRequest = {
      citaId: cita.id,
      metodoPago: this.metodoPago(),
      ...(this.metodoPago() === 'EFECTIVO'
        ? { montoRecibido: this.montoRecibido() ?? 0 }
        : {
            yapePhoneNumber: Number(this.yapePhone()),
            yapeOtp: Number(this.yapeOtp()),
            payerEmail: this.yapeEmail().trim()
          })
    };

    this.loadingStore.show();
    this.pagoService.registrar(request).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Pago registrado', detail: `Pago con ${this.metodoPago() === 'EFECTIVO' ? 'efectivo' : 'Yape'} registrado correctamente` });
        this.displayCajaModal.set(false);
        this.loadCitas();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar el pago' });
        this.loadingStore.hide();
      }
    });
  }

  get horarioDelDiaSeleccionado(): HorarioEmpleadoResponse | null {
    const v = this.citaForm.get('fechaHoraInicio')?.value;
    if (!v) return null;
    const fecha = typeof v === 'string' ? new Date(v) : v as Date;
    const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    return this.horariosVeterinario().find(h => h.diaSemana === dias[fecha.getDay()]) ?? null;
  }

  get mensajeHorario(): string {
    const h = this.horarioDelDiaSeleccionado;
    if (!h) return 'El médico no atiende ese día de la semana.';
    return `Fuera del horario del médico. Disponible: ${h.horaInicio} – ${h.horaFin}`;
  }

  get horariosActivos(): HorarioEmpleadoResponse[] {
    return this.horariosVeterinario().filter(h => h.activo !== false);
  }

  get horariosResumen(): HorarioResumen[] {
    return this.buildHorarioResumen(this.horariosActivos);
  }

  formatDiaSemana(dia: string): string {
    const labels: Record<string, string> = {
      LUNES: 'Lunes',
      MARTES: 'Martes',
      MIERCOLES: 'Miércoles',
      JUEVES: 'Jueves',
      VIERNES: 'Viernes',
      SABADO: 'Sábado',
      DOMINGO: 'Domingo'
    };
    return labels[dia] ?? dia;
  }

  formatHora(hora: string): string {
    return hora?.substring(0, 5) ?? '';
  }

  private buildHorarioResumen(horarios: HorarioEmpleadoResponse[]): HorarioResumen[] {
    const groups = new Map<string, {
      diaSemana: string;
      horaInicio: string;
      horaFin: string;
      fechas: Set<string>;
    }>();

    for (const horario of horarios) {
      const horaInicio = this.formatHora(horario.horaInicio);
      const horaFin = this.formatHora(horario.horaFin);
      const key = `${horario.diaSemana}|${horaInicio}|${horaFin}`;
      const current = groups.get(key) ?? {
        diaSemana: horario.diaSemana,
        horaInicio,
        horaFin,
        fechas: new Set<string>()
      };

      if (horario.fecha) {
        current.fechas.add(String(horario.fecha).substring(0, 10));
      }

      groups.set(key, current);
    }

    const order = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    return Array.from(groups.values())
      .sort((a, b) => {
        const dayCmp = order.indexOf(a.diaSemana) - order.indexOf(b.diaSemana);
        if (dayCmp !== 0) return dayCmp;
        return a.horaInicio.localeCompare(b.horaInicio);
      })
      .map(group => {
        const fechas = Array.from(group.fechas).sort();
        return {
          diaSemana: group.diaSemana,
          horaInicio: group.horaInicio,
          horaFin: group.horaFin,
          rangoFechas: this.formatRangoFechas(fechas),
          totalFechas: fechas.length
        };
      });
  }

  private formatRangoFechas(fechas: string[]): string {
    if (fechas.length === 0) return 'Horario recurrente';
    if (fechas.length === 1) return `Fecha: ${this.formatFechaCorta(fechas[0])}`;
    return `${this.formatFechaCorta(fechas[0])} - ${this.formatFechaCorta(fechas[fechas.length - 1])}`;
  }

  private formatFechaCorta(fecha: string): string {
    const [year, month, day] = fecha.split('-');
    if (!year || !month || !day) return fecha;
    return `${day}/${month}/${year}`;
  }

  toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  getCitasDia(d: Date): CitaResponse[] { return this.citasPorDia()[this.toDateStr(d)] ?? []; }
  getCitasHora(d: Date, h: number): CitaResponse[] {
    return this.getCitasDia(d).filter(c => new Date(c.fechaHoraInicio).getHours() === h);
  }
  esHoy(d: Date): boolean { return this.toDateStr(d) === this.toDateStr(new Date()); }
  esMesActual(d: Date): boolean {
    const b = this.fechaBase();
    return d.getMonth() === b.getMonth() && d.getFullYear() === b.getFullYear();
  }

  tituloCalendario(): string {
    const base = this.fechaBase();
    const v = this.vistaActual();
    if (v === 'dia') return base.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (v === 'semana') {
      const dias = this.diasSemanaActual();
      return `${dias[0].toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} – ${dias[6].toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return base.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  }

  clickDiaMes(d: Date) {
    this.fechaBase.set(d);
    this.filterFecha = this.toDateStr(d);
    this.cambiarVista('dia');
  }
}

class AgendaStompClient {
  private socket: WebSocket | null = null;
  private connected = false;
  private subscriptions = new Map<string, (payload: any) => void>();
  private subIdCounter = 0;

  constructor(private url: string) {}

  isConnected(): boolean { return this.connected; }

  connect(onConnect: () => void, onError: (err: any) => void) {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.socket?.send(`CONNECT\naccept-version:1.1,1.2\nheart-beat:10000,10000\n\n\0`);
      };

      this.socket.onmessage = (event) => {
        let data = (event.data as string).replace(/\r\n/g, '\n');
        if (!data || data === '\n') return;

        if (data.startsWith('CONNECTED')) {
          this.connected = true;
          onConnect();
          this.subscriptions.forEach((_, dest) => this.sendSubscribeFrame(dest));
        } else if (data.startsWith('MESSAGE')) {
          const bodyStart = data.indexOf('\n\n');
          if (bodyStart === -1) return;
          const body = data.substring(bodyStart + 2, data.lastIndexOf('\0')).trim();
          try {
            const parsed = JSON.parse(body);
            const destMatch = data.match(/destination:([^\n]+)/);
            if (destMatch) {
              const cb = this.subscriptions.get(destMatch[1].trim());
              if (cb) cb(parsed);
            }
          } catch (e) { console.error('[Agenda WS] Parse error', e); }
        }
      };

      this.socket.onerror  = (err) => onError(err);
      this.socket.onclose  = () => {
        this.connected = false;
        if (this.socket) {
          setTimeout(() => { if (this.socket && !this.connected) this.connect(onConnect, onError); }, 5000);
        }
      };
    } catch (e) { onError(e); }
  }

  subscribe(destination: string, callback: (payload: any) => void) {
    this.subscriptions.set(destination, callback);
    if (this.connected) this.sendSubscribeFrame(destination);
  }

  private sendSubscribeFrame(destination: string) {
    this.socket?.send(`SUBSCRIBE\nid:sub-${this.subIdCounter++}\ndestination:${destination}\n\n\0`);
  }

  disconnect() {
    this.connected = false;
    this.subscriptions.clear();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.close();
      this.socket = null;
    }
  }
}
