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
import { AgendaCounters, CitaService } from '../../../core/services/cita.service';
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
import { InputFilterDirective } from '../../../core/directives/input-filter.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { hasMeaningfulText, isLowercaseEmail } from '../../../core/utils/input-validation.util';
import { ControlPreventivoService } from '../../../core/services/control-preventivo.service';
import { ControlPreventivoResponse } from '../../../models/response/control-preventivo-response';
import { RealtimeTicketService } from '../../../core/services/realtime-ticket.service';
export type Vista = 'lista' | 'dia' | 'semana' | 'mes';
export type PeriodoAgenda = '' | 'hoy' | '7dias' | '30dias' | 'personalizado';

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
    DatePickerModule,
    DropdownModule,
    CalendarModule,
    TooltipModule,
    MenuModule,

    ConfirmDialogModule,
    ToastModule,
    FullCalendarModule,
    HasPermissionDirective,
    InputFilterDirective
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.scss'
})
export class AgendaComponent implements OnInit, OnDestroy {
  @ViewChild('fullCalendar') fullCalendar?: FullCalendarComponent;
  private readonly citaActionItemsCache = new WeakMap<CitaResponse, MenuItem[]>();

  private readonly fb                = inject(FormBuilder);
  private readonly citaService       = inject(CitaService);
  private readonly empleadoService   = inject(EmpleadoService);
  private readonly apoderadoService  = inject(ApoderadoService);
  private readonly mascotaService    = inject(MascotaService);
  private readonly razaService       = inject(RazaService);
  private readonly companyService    = inject(CompanyService);
  private readonly servicioService   = inject(ServicioService);
  private readonly preventivoService = inject(ControlPreventivoService);
  private readonly pagoService       = inject(PagoService);
  private readonly cajaService       = inject(CajaService);
  private readonly realtimeTicketService = inject(RealtimeTicketService);
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
  agendaFirst = 0;
  private suppressSseToast = false;
  totalRecords     = signal<number>(0);
  agendaCounters   = signal<AgendaCounters>({
    programadas: 0,
    enProceso: 0,
    completadas: 0,
    canceladas: 0
  });
  displayModal     = signal<boolean>(false);
  displayCancelModal = signal<boolean>(false);
  displayDeleteModal = signal<boolean>(false);
  displayDetalleCita = signal<boolean>(false);
  citaDetalle        = signal<CitaResponse | null>(null);
  displayCajaModal   = signal<boolean>(false);
  citaParaPago       = signal<CitaResponse | null>(null);
  metodoPago         = signal<MetodoPago>('EFECTIVO');
  montoRecibido      = signal<number | null>(null);
  readonly billetesEfectivo = [10, 20, 50, 100, 200];
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
  originalCitaEdit = signal<CitaResponse | null>(null);
  isEditing = computed(() => !!this.citaForm?.get('id')?.value && !this.isReprogramando());
  
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
  controlesPreventivosMascota = signal<ControlPreventivoResponse[]>([]);
  readonly controlesParaServicio = computed(() => {
    const servicio = this.serviciosConDetalle().find(s => s.id === this.selectedServicioId());
    const tipo = servicio?.tipoControlPreventivo;
    if (tipo !== 'VACUNACION' && tipo !== 'DESPARASITACION') return [];
    return this.controlesPreventivosMascota().filter(c => c.tipo === tipo && !['APLICADO', 'CANCELADO', 'SUSPENDIDO_POR_CITA'].includes(c.estado));
  });
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
    this.showCalendarPicker.set(false);
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
  ncDireccion = signal('');

  showNuevaMascota   = signal(false);
  savingNuevaMascota = signal(false);
  nmNombre    = signal('');
  nmEspecie   = signal('PERRO');
  nmRazaId    = signal<number | null>(null);
  nmSexo      = signal('MACHO');
  nmFechaNac  = signal('');
  razasAgenda = signal<RazaResponse[]>([]);

  private sanitizePersonName(value: string): string {
    return (value ?? '')
      .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+/, '')
      .slice(0, 80);
  }

  private normalizePersonName(value: string): string {
    return this.sanitizePersonName(value).trim().replace(/\s+/g, ' ');
  }

  private sanitizeDocumentNumber(value: string, tipo: string): string {
    const raw = (value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (tipo === 'PASAPORTE') {
      let filtered = '';
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (i === 0 && /[A-Z]/.test(ch)) {
          filtered += ch;
        } else if (i > 0 && /\d/.test(ch)) {
          filtered += ch;
        }
      }
      return filtered.slice(0, 9);
    }

    return raw.replace(/\D/g, '').slice(0, tipo === 'DNI' ? 8 : 9);
  }

  onNewClientNameChange(value: string) {
    this.ncNombre.set(this.sanitizePersonName(value));
  }

  onNewClientLastNameChange(value: string) {
    this.ncApellido.set(this.sanitizePersonName(value));
  }

  onNewClientDocumentTypeChange(tipo: string) {
    this.ncTipoDoc.set(tipo);
    this.ncNumDoc.set(this.sanitizeDocumentNumber(this.ncNumDoc(), tipo));
  }

  onNewClientDocumentChange(value: string) {
    this.ncNumDoc.set(this.sanitizeDocumentNumber(value, this.ncTipoDoc()));
  }

  onNewPetNameChange(value: string) {
    this.nmNombre.set(this.sanitizePersonName(value));
  }
  today: Date                     = new Date();
  filterFecha: string             = this.toDateStr(new Date());
  filterEstado: EstadoCita | null = null;
  filterVeterinarioId: number | null = null;
  filtersOpen                        = false;
  agendaPeriodo: PeriodoAgenda       = '';
  agendaFechaDesde: string           = this.toDateStr(new Date());
  agendaFechaHasta: string           = this.toDateStr(new Date());

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }
  vistaActual  = signal<Vista>('lista');
  fechaBase    = signal<Date>(new Date());
  showCalendarPicker = signal(false);
  pickerYear    = signal(new Date().getFullYear());
  readonly mesesPicker = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
  citasPorDia  = signal<Record<string, CitaResponse[]>>({});
  readonly citasAgenda = computed(() =>
    this.citas().map(cita => ({
      ...cita,
      fechaGrupo: cita.fechaHoraInicio?.substring(0, 10) ?? ''
    }))
  );
  calendarEvents = signal<EventInput[]>([]);
  cargandoCal  = signal<boolean>(false);
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridDay',
    initialDate: new Date(),
    locale: 'es',
    firstDay: 1,
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
    views: {
      timeGridWeek: {
        slotDuration: '00:30:00'
      },
      dayGridMonth: {
        fixedWeekCount: false,
        showNonCurrentDates: false
      }
    },
    expandRows: true,
    stickyHeaderDates: true,
    dayMaxEvents: 2,
    moreLinkContent: (args) => `+${args.num} más`,
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

  getReadOnlyFechaHora(): string {
    const fechaHora = this.citaForm.get('fechaHoraInicio')?.value;
    if (!fechaHora) return '—';
    const d = new Date(fechaHora);
    if (isNaN(d.getTime())) return fechaHora;
    const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fecha} ${hora}`;
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

  hasFiltrosActivos(): boolean {
    return this.filterEstado !== null
      || this.filterVeterinarioId !== null
      || (this.vistaActual() === 'lista'
        ? this.agendaPeriodo !== 'hoy'
        : this.filterFecha !== this.toDateStr(new Date()));
  }

  limpiarFiltros() {
    this.filterFecha = this.toDateStr(new Date());
    this.filterEstado = null;
    this.filterVeterinarioId = null;
    this.agendaPeriodo = '';
    this.agendaFechaDesde = this.toDateStr(new Date());
    this.agendaFechaHasta = this.toDateStr(new Date());
    this.showEstadoFilter.set(false);
    this.showVeterinarioFilter.set(false);
    this.fechaBase.set(new Date());
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
    motivoCita:      ['',   [Validators.required, Validators.minLength(5), Validators.maxLength(250), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    fechaHoraInicio: [null, [Validators.required, this.horariosValidator]],
    fechaCita:       [null],
    horaCita:        [null],
    servicioId:      [null, [Validators.required]],
    notas:           ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    esEmergencia:    [false],
    controlPreventivoIds: [[] as number[]]
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
      const urlObj = new URL(environment.wsApiUrl);
      const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      let path = urlObj.pathname.trim();
      if (path.endsWith('/')) path = path.slice(0, -1);
      const wsUrl = `${wsProtocol}//${urlObj.host}${path}/ws/websocket`;

      this.realtimeTicketService.issue().subscribe({
        next: ({ data }) => {
          this.stompClient = new AgendaStompClient(wsUrl, data.ticket);
          this.stompClient.connect(() => {
            this.stompClient?.subscribe(destination, (event: CitaWsEvent) => {
            this.handleCitaWsEvent(event);
            });
          }, (err) => console.error('[Agenda WS] Error:', err),
          () => setTimeout(() => this.setupWebSocket(), 5000));
        },
        error: err => console.error('[Agenda WS] No se pudo autorizar:', err)
      });
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
      this.agendaFirst = event.first ?? 0;
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
    const esAgenda = this.vistaActual() === 'lista';
    const fechaStr = esAgenda ? undefined : (this.filterFecha || undefined);
    const rangoAgenda = esAgenda ? this.getAgendaRange() : null;
    if (esAgenda && this.agendaPeriodo && (!rangoAgenda || this.agendaRangoError())) {
      this.citas.set([]);
      this.totalRecords.set(0);
      this.agendaCounters.set({ programadas: 0, enProceso: 0, completadas: 0, canceladas: 0 });
      return;
    }
    const veterinarioId = this.getEffectiveVeterinarioFilter();
    if (esAgenda) {
      const rangoContadores = rangoAgenda;
      this.loadAgendaCounters(companyId, rangoContadores?.desde, rangoContadores?.hasta, veterinarioId);
    }

    this.citaService.listar(
      companyId,
      fechaStr,
      this.filterEstado    || undefined,
      veterinarioId,
      page,
      event.rows,
      rangoAgenda?.desde,
      rangoAgenda?.hasta
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
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las citas' });
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
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los dueños' });
      }
    });
  }

  loadAllMascotas(companyId?: number) {
    const targetCompanyId = companyId || (this.activeCompanyId ?? undefined);
    this.mascotaService.listar(targetCompanyId, undefined, undefined, 0, 500).subscribe({
      next: (res) => this.allMascotas.set(res.data.content),
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las mascotas' });
      }
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
    this.clienteSearch.set('');
    this.resetNuevoClienteForm();
    this.showNuevaMascota.set(false);
    this.nmNombre.set('');
    this.nmEspecie.set('PERRO');
    this.nmRazaId.set(null);
    this.nmSexo.set('MACHO');
    this.nmFechaNac.set('');
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
    this.citaForm.patchValue({ controlPreventivoIds: [] });
    this.preventivoService.listarControles(mascota.value).subscribe({
      next: res => this.controlesPreventivosMascota.set(res.data ?? []),
      error: () => this.controlesPreventivosMascota.set([])
    });
  }

  private resetNuevoClienteForm() {
    this.showNuevoCliente.set(false);
    this.savingNuevoCliente.set(false);
    this.ncNombre.set('');
    this.ncApellido.set('');
    this.ncTelefono.set('');
    this.ncCorreo.set('');
    this.ncTipoDoc.set('DNI');
    this.ncNumDoc.set('');
    this.ncGenero.set('MASCULINO');
    this.ncDireccion.set('');
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
    this.citaForm.patchValue({ controlPreventivoIds: [] });
    this.citaForm.get('veterinarioId')?.setValue(null);
    this.horariosVeterinario.set([]);
    this.availableSlots.set([]);
    this.citaForm.get('horaCita')?.setValue(null);
    this.showServicioSelector.set(false);
    this.filterEmpleadosByServicio(srv?.value ?? null);
    this.onBookingParamsChange();
  }

  controlPreventivoSeleccionado(id: number): boolean {
    return (this.citaForm.get('controlPreventivoIds')?.value ?? []).includes(id);
  }

  toggleControlPreventivo(id: number, checked: boolean) {
    const actuales: number[] = this.citaForm.get('controlPreventivoIds')?.value ?? [];
    this.citaForm.patchValue({
      controlPreventivoIds: checked ? [...actuales, id] : actuales.filter(actual => actual !== id)
    });
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

    if (val.esEmergencia) {
      const now = new Date();
      const dateStr = this.toDateStr(now);
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      this.citaForm.patchValue({ fechaCita: dateStr, horaCita: `${hours}:${mins}` });
      this.availableSlots.set([]);
      return;
    }

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
    this.ncDireccion.set('');
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
    this.originalCitaEdit.set(cita);
    this.availableSlots.set([]);
    this.editarCita(cita);
  }

  editarCita(cita: CitaResponse) {
    this.originalCitaEdit.set(cita);
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
      esEmergencia: cita.esEmergencia,
      controlPreventivoIds: cita.controlPreventivoIds ?? []
    });
    this.preventivoService.listarControles(cita.mascotaId).subscribe({
      next: res => this.controlesPreventivosMascota.set(res.data ?? [])
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
    const nombre     = normalizeText(this.normalizePersonName(this.ncNombre()));
    const apellido   = normalizeText(this.normalizePersonName(this.ncApellido()));
    const telefono   = this.ncTelefono().trim();
    const correo     = this.ncCorreo().trim();
    const numDoc     = this.sanitizeDocumentNumber(this.ncNumDoc(), this.ncTipoDoc());
    const direccion  = normalizeText(this.ncDireccion());

    this.ncNombre.set(nombre);
    this.ncApellido.set(apellido);
    this.ncNumDoc.set(numDoc);

    if (!nombre || !apellido || !telefono || !correo || !numDoc || !direccion) {
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Complete todos los campos del nuevo cliente.' });
      return;
    }
    if (!hasMeaningfulText(nombre) || !hasMeaningfulText(apellido) || !/^[\p{L}\s]+$/u.test(nombre) || !/^[\p{L}\s]+$/u.test(apellido)) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre inválido', detail: 'Nombres y apellidos solo aceptan letras y espacios.' });
      return;
    }
    if (!/^\d{9}$/.test(telefono)) {
      this.messageService.add({ severity: 'warn', summary: 'Teléfono inválido', detail: 'Debe tener exactamente 9 dígitos.' });
      return;
    }
    if (!isLowercaseEmail(correo)) {
      this.messageService.add({ severity: 'warn', summary: 'Correo inválido', detail: 'Use un correo válido en minúsculas.' });
      return;
    }
    if (direccion.length > 200 || !hasMeaningfulText(direccion) || !/^[\p{L}\p{N}\s.,#\-\/\u00B0:]+$/u.test(direccion)) {
      this.messageService.add({ severity: 'warn', summary: 'Dirección inválida', detail: 'Verifique la dirección ingresada (máximo 200 caracteres).' });
      return;
    }

    const documentoValido = this.ncTipoDoc() === 'DNI'
      ? /^\d{8}$/.test(numDoc)
      : this.ncTipoDoc() === 'PASAPORTE'
        ? /^[a-zA-Z]\d{8}$/.test(numDoc)
        : /^\d{9}$/.test(numDoc);
    if (!documentoValido) {
      this.messageService.add({ severity: 'warn', summary: 'Documento inválido', detail: 'Verifique el formato del documento.' });
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
      direccion,
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
        this.ncDireccion.set('');
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

  private maxEdadMascotaPorEspecie(especie: string): number {
    const maximos: Record<string, number> = {
      PERRO: 20,
      GATO: 20,
      AVE: 80,
      REPTIL: 100,
      ROEDOR: 15,
      OTRO: 100,
      EXOTICO: 100
    };
    return maximos[especie] ?? 100;
  }

  private fechaMinimaNacimientoPorEspecie(especie: string): string {
    const fecha = new Date();
    fecha.setFullYear(fecha.getFullYear() - this.maxEdadMascotaPorEspecie(especie));
    return this.toDateStr(fecha);
  }

  crearNuevaMascota() {
    const apoderadoId = this.selectedClienteId();
    if (!apoderadoId) {
      this.messageService.add({ severity: 'warn', summary: 'Sin dueño', detail: 'Selecciona o crea un cliente primero.' });
      return;
    }
    const nombre = normalizeText(this.normalizePersonName(this.nmNombre()));
    const razaId = this.nmRazaId();
    const fecha  = this.nmFechaNac().trim();
    this.nmNombre.set(nombre);
    if (!nombre || !razaId || !fecha) {
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Complete nombre, raza y fecha de nacimiento.' });
      return;
    }
    if (!hasMeaningfulText(nombre) || !/^[\p{L}\s]+$/u.test(nombre)) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre inválido', detail: 'El nombre de la mascota solo acepta letras y espacios.' });
      return;
    }
    if (fecha > this.toDateStr(this.today)) {
      this.messageService.add({ severity: 'warn', summary: 'Fecha inválida', detail: 'La fecha de nacimiento no puede ser futura.' });
      return;
    }
    const especie = this.nmEspecie();
    if (fecha < this.fechaMinimaNacimientoPorEspecie(especie)) {
      this.messageService.add({ severity: 'warn', summary: 'Fecha inválida', detail: `La edad no debe superar ${this.maxEdadMascotaPorEspecie(especie)} años para esta especie.` });
      return;
    }

    this.savingNuevaMascota.set(true);
    this.mascotaService.crear({
      nombreCompleto: nombre,
      especie,
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
      // Edit: use the original cita's date/time (not editable in this flow)
      const orig = this.originalCitaEdit();
      localIsoString = orig?.fechaHoraInicio ?? formValue.fechaHoraInicio;
    }

    if (!isEditing && this.isPastDateTime(new Date(localIsoString))) {
      this.messageService.add({ severity: 'warn', summary: 'Fecha invalida', detail: 'La fecha de la cita no puede estar en el pasado.' });
      return;
    }

    const request: CitaRequest = {
      ...formValue,
      motivoCita: normalizeText(formValue.motivoCita),
      notas: normalizeText(formValue.notas),
      fechaHoraInicio: localIsoString
    };

    // Edit: preserve original vet, service, emergency fields (not editable)
    if (isEditing) {
      const orig = this.originalCitaEdit();
      if (orig) {
        request.veterinarioId = orig.veterinarioId;
        request.servicioId = orig.servicioId;
        request.esEmergencia = orig.esEmergencia;
        request.version = orig.version;
      }
    }
    
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
      },
      error: (err: any) => {
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: err.error?.message || 'Error al procesar la cita' 
        });
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
          this.citaService.reprogramar(id, request).subscribe(observer);
        },
        reject: () => {
        }
      });
    } else if (id) {
      this.citaService.actualizar(id, request).subscribe(observer);
    } else {
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
    const cached = this.citaActionItemsCache.get(cita);
    if (cached) return cached;

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

    const puedeIniciar = cita.estado === 'PROGRAMADA' || cita.estado === 'CONFIRMADA'
      || cita.estado === 'SALA_DE_ESPERA' || cita.estado === 'REPROGRAMADA';
    const esConsultaClinica = cita.requiereConsultaClinica !== false;
    if (puedeIniciar && canModifyCita && (!esConsultaClinica || this.canCreateHistoria())) {
      items.push({
        label: esConsultaClinica ? 'Iniciar consulta' : 'Iniciar servicio',
        icon: 'pi pi-play',
        command: () => this.iniciarCita(cita)
      });
    }

    if (esConsultaClinica && this.canReadHistoria() && cita.estado === 'EN_PROCESO') {
      items.push({ label: 'Continuar consulta', icon: 'pi pi-pencil', command: () => this.continuarConsulta(cita) });
    }

    if (!esConsultaClinica && canModifyCita && cita.estado === 'EN_PROCESO') {
      items.push({ label: 'Finalizar servicio', icon: 'pi pi-check', command: () => this.finalizarServicio(cita) });
    }

    if (esConsultaClinica && this.canReadHistoria() && (cita.estado === 'COMPLETADA' || cita.consultaId) && cita.estado !== 'EN_PROCESO') {
      items.push({ label: 'Ver consulta', icon: 'pi pi-file', command: () => this.continuarConsulta(cita, true) });
    }

    if (this.canCancel(cita) && canModifyCita) {
      items.push({ label: 'Cancelar', icon: 'pi pi-times', command: () => this.cancelarCita(cita) });
    }

    if (cita.estado === 'CANCELADA' && canDeleteCita) {
      items.push({ label: 'Eliminar', icon: 'pi pi-trash', command: () => this.eliminarCita(cita) });
    }

    this.citaActionItemsCache.set(cita, items);
    return items;
  }

  verDetalleCita(cita: CitaResponse) {
    this.citaDetalle.set(cita);
    this.displayDetalleCita.set(true);
  }

  iniciarCita(cita: CitaResponse) {
    const esConsultaClinica = cita.requiereConsultaClinica !== false;
    if (esConsultaClinica && !this.canCreateHistoria()) {
      this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No puedes iniciar historias clínicas.' });
      return;
    }
    this.displayDetalleCita.set(false);
    this.citaService.iniciarAtencion(cita.id).subscribe({
      next: (res) => {
        this.suppressSseToast = true;
        this.messageService.add({
          severity: 'success',
          summary: 'Listo',
          detail: esConsultaClinica ? 'Consulta iniciada' : 'Servicio iniciado'
        });
        if (res.data) {
          this.router.navigate(['/historias-clinicas/consulta', res.data], { queryParams: { returnUrl: '/citas/agenda' } });
        } else {
          this.loadCitas();
        }
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al iniciar atención' });
      }
    });
  }

  finalizarServicio(cita: CitaResponse) {
    this.displayDetalleCita.set(false);
    this.confirmationService.confirm({
      message: `¿Confirmas que el servicio «${cita.servicioNombre || cita.motivoCita}» fue terminado?`,
      header: 'Finalizar servicio',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, finalizar',
      rejectLabel: 'Volver',
      accept: () => {
        this.citaService.finalizarServicio(cita.id).subscribe({
          next: () => {
            this.suppressSseToast = true;
            this.messageService.add({ severity: 'success', summary: 'Servicio completado', detail: 'El servicio quedó registrado en el historial de la mascota.' });
            this.loadCitas();
            if (this.vistaActual() !== 'lista') this.loadCitasCalendario();
          },
          error: (err) => this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'No se pudo finalizar el servicio'
          })
        });
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
        this.citaService.cancelarCita(cita.id, '').subscribe({
          next: () => {
            this.suppressSseToast = true;
            this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Cita cancelada correctamente.' });
            this.loadCitas();
            if (this.vistaActual() !== 'lista') this.loadCitasCalendario();
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

    this.citaService.eliminarCita(cita.id).subscribe({
      next: () => {
        this.suppressSseToast = true;
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Cita eliminada correctamente' });
        this.displayDeleteModal.set(false);
        this.loadCitas();
        if (this.vistaActual() !== 'lista') this.loadCitasCalendario();
      },
      error: (err) => {
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: err.error?.message || 'No se pudo eliminar la cita' 
        });
      }
    });
  }

  continuarConsulta(cita: CitaResponse, soloLectura = false) {
    if (!this.canReadHistoria()) {
      this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No puedes ver historias clínicas.' });
      return;
    }
    this.displayDetalleCita.set(false);
    if (cita.consultaId) {
      this.router.navigate(['/historias-clinicas/consulta', cita.consultaId], {
        queryParams: {
          returnUrl: '/citas/agenda',
          mode: soloLectura ? 'view' : undefined
        }
      });
    } else {
      if (soloLectura) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Consulta no disponible',
          detail: 'No se encontró una consulta clínica vinculada a esta cita.'
        });
        return;
      }
      if (!this.canCreateHistoria()) {
        this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No puedes iniciar historias clínicas.' });
        return;
      }
      this.citaService.iniciarAtencion(cita.id).subscribe({
        next: (res) => {
          if (res.data) {
            this.router.navigate(['/historias-clinicas/consulta', res.data], { queryParams: { returnUrl: '/citas/agenda' } });
          } else {
            this.loadCitas();
          }
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo recuperar la consulta activa' });
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
      case EstadoCita.EN_PROCESO:     return 'bg-amber-50 text-amber-700 border border-amber-200';
      case EstadoCita.COMPLETADA:     return 'bg-emerald-100 text-emerald-700';
      case EstadoCita.CANCELADA:      return 'bg-rose-100 text-rose-600';
      case EstadoCita.ELIMINADA:      return 'bg-red-100 text-red-600';
      default:                        return 'bg-slate-100 text-slate-600';
    }
  }

  cambiarVista(vista: Vista) {
    this.showCalendarPicker.set(false);
    this.vistaActual.set(vista);
    if (vista === 'lista') {
      this.recargarAgendaDesdeInicio();
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

  toggleCalendarPicker() {
    if (!this.showCalendarPicker()) this.pickerYear.set(this.fechaBase().getFullYear());
    this.showCalendarPicker.update(v => !v);
  }

  pickerYearPrev() { this.pickerYear.update(y => y - 1); }
  pickerYearNext() { this.pickerYear.update(y => y + 1); }

  seleccionarMesPicker(mesIndex: number) {
    const nueva = new Date(this.pickerYear(), mesIndex, 1);
    this.fechaBase.set(nueva);
    this.filterFecha = this.toDateStr(nueva);
    this.showCalendarPicker.set(false);
    this.refreshCurrentView();
  }

  seleccionarFechaPicker(fecha: Date | null) {
    if (!fecha) return;
    const nueva = new Date(fecha);
    nueva.setHours(0, 0, 0, 0);
    this.fechaBase.set(nueva);
    this.filterFecha = this.toDateStr(nueva);
    this.showCalendarPicker.set(false);
    this.refreshCurrentView();
  }

  esMesPickerActivo(mesIndex: number): boolean {
    const b = this.fechaBase();
    return b.getMonth() === mesIndex && b.getFullYear() === this.pickerYear();
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

  onAgendaPeriodoChange() {
    if (this.agendaPeriodo === 'personalizado') {
      const hoy = this.toDateStr(new Date());
      this.agendaFechaDesde = this.agendaFechaDesde || hoy;
      this.agendaFechaHasta = this.agendaFechaHasta || hoy;
    }
    this.recargarAgendaDesdeInicio();
  }

  onAgendaRangeChange() {
    if (!this.agendaRangoError()) {
      this.recargarAgendaDesdeInicio();
    }
  }

  agendaRangoError(): string | null {
    if (this.agendaPeriodo !== 'personalizado') return null;
    if (!this.agendaFechaDesde || !this.agendaFechaHasta) {
      return 'Seleccione ambas fechas.';
    }
    const desde = this.parseDateStr(this.agendaFechaDesde);
    const hasta = this.parseDateStr(this.agendaFechaHasta);
    if (desde > hasta) {
      return 'La fecha inicial no puede ser posterior a la final.';
    }
    const dias = Math.floor((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;
    return dias > 90 ? 'El periodo máximo permitido es de 90 días.' : null;
  }

  formatAgendaGroupLabel(fecha: string): string {
    const fechaDate = this.parseDateStr(fecha);
    return fechaDate.toLocaleDateString('es-PE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  avatarPastelClass(nombre?: string): string {
    const palettes = [
      'bg-sky-100 text-sky-700',
      'bg-indigo-100 text-indigo-700',
      'bg-violet-100 text-violet-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700'
    ];
    const seed = (nombre ?? '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    return palettes[seed % palettes.length];
  }

  motivoPastelClass(cita: CitaResponse): string {
    const texto = `${cita.servicioNombre ?? ''} ${cita.motivoCita ?? ''}`.toLowerCase();
    if (texto.includes('vacun')) return 'bg-violet-100 text-violet-700';
    if (texto.includes('desparasit')) return 'bg-cyan-50 text-cyan-700';
    if (texto.includes('emerg')) return 'bg-rose-100 text-rose-700';
    if (texto.includes('control')) return 'bg-sky-100 text-sky-700';
    return 'bg-slate-100 text-slate-600';
  }

  agendaEmptyTitle(): string {
    if (!this.agendaPeriodo) return 'No hay citas registradas';
    const periodo = this.agendaPeriodo || 'hoy';
    if (periodo === 'hoy') return 'No hay citas programadas para hoy';
    const rango = this.getAgendaRange();
    if (!rango) return 'No hay citas en el periodo seleccionado';
    return `No hay citas entre el ${this.formatShortDate(rango.desde)} y el ${this.formatShortDate(rango.hasta)}`;
  }

  agendaPeriodoLabel(): string {
    if (!this.agendaPeriodo) return 'Todas las citas';
    switch (this.agendaPeriodo) {
      case '7dias': return 'Próximos 7 días';
      case '30dias': return 'Próximos 30 días';
      case 'personalizado': return 'Rango seleccionado';
      default: return 'Hoy';
    }
  }

  private getAgendaRange(): { desde: string; hasta: string } | null {
    if (!this.agendaPeriodo) return null;
    const hoy = new Date();
    if (this.agendaPeriodo === 'personalizado') {
      if (!this.agendaFechaDesde || !this.agendaFechaHasta) return null;
      return { desde: this.agendaFechaDesde, hasta: this.agendaFechaHasta };
    }

    const dias = this.agendaPeriodo === '7dias' ? 6 : this.agendaPeriodo === '30dias' ? 29 : 0;
    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() + dias);
    return { desde: this.toDateStr(hoy), hasta: this.toDateStr(hasta) };
  }

  private recargarAgendaDesdeInicio() {
    this.agendaFirst = 0;
    this.lastLazyEvent = { ...this.lastLazyEvent, first: 0 };
    this.loadCitas();
  }

  private parseDateStr(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatShortDate(value: string): string {
    return this.parseDateStr(value).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short'
    });
  }

  private loadAgendaCounters(
    companyId: number,
    fechaDesde?: string,
    fechaHasta?: string,
    veterinarioId?: number
  ) {
    this.citaService.obtenerContadores(companyId, fechaDesde, fechaHasta, veterinarioId).pipe(
      catchError(() => of({
        data: { programadas: 0, enProceso: 0, completadas: 0, canceladas: 0 }
      } as any))
    ).subscribe(res => this.agendaCounters.set(res.data));
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

    // Semana / Mes: una sola llamada por el rango visible, se agrupa en frontend
    const maxSize = this.vistaActual() === 'semana' ? 100 : 200;
    const diasVisibles = this.vistaActual() === 'semana' ? this.diasSemanaActual() : this.diasMesActual();
    const fechaDesde = this.toDateStr(diasVisibles[0]);
    const fechaHasta = this.toDateStr(diasVisibles[diasVisibles.length - 1]);
    this.citaService.listar(
      companyId,
      undefined,
      this.filterEstado || undefined,
      veterinarioId,
      0,
      maxSize,
      fechaDesde,
      fechaHasta
    ).pipe(
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
    const background = cita ? this.calendarBgColor(cita.estado) : '#eff6ff';
    const timeHtml = info.timeText
      ? `<span class="agenda-event-time" style="color:${accent}">${info.timeText}</span>`
      : '';
    const title   = cita?.mascotaNombre ?? info.event.title;
    const service = cita?.servicioNombre ?? cita?.veterinarioNombre ?? '';
    const estado  = cita ? this.estadoLabel(cita.estado) : '';

    if (info.view.type === 'dayGridMonth') {
      return {
        html: `
          <div class="agenda-month-event" style="border-left-color:${accent};background:${background}">
            <span class="agenda-month-event-title">${this.escapeHtml(title)}</span>
            <span class="agenda-month-event-meta">
              ${timeHtml}
              ${service ? `<span class="agenda-month-event-service">${this.escapeHtml(service)}</span>` : ''}
            </span>
          </div>
        `
      };
    }

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
      },
      error: (err) => {
        info.revert();
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo reprogramar',
          detail: err.error?.message || 'El nuevo horario no está disponible.'
        });
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

  // TEMPORAL (periodo de pruebas): validación de fecha pasada desactivada. Revertir a la línea original cuando termine.
  private isPastDateTime(date: Date): boolean {
    return date.getTime() < Date.now() - 60_000;
  }

  canCobrar(cita: CitaResponse): boolean {
    return false;
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
      ...(this.metodoPago() === 'EFECTIVO' ? { montoRecibido: this.montoRecibido() ?? 0 } : {})
    };

    this.pagoService.registrar(request).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Pago registrado', detail: `Pago con ${this.metodoPago() === 'EFECTIVO' ? 'efectivo' : 'Yape'} registrado correctamente` });
        this.displayCajaModal.set(false);
        this.loadCitas();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar el pago' });
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

  constructor(private url: string, private ticket: string) {}

  isConnected(): boolean { return this.connected; }

  connect(onConnect: () => void, onError: (err: any) => void, onClose?: () => void) {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.socket?.send(`CONNECT\naccept-version:1.1,1.2\nheart-beat:10000,10000\nticket:${this.ticket}\n\n\0`);
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
        onClose?.();
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


