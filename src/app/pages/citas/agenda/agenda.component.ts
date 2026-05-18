import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
import { MessageService, ConfirmationService } from 'primeng/api';
import { CitaService } from '../../../core/services/cita.service';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MascotaService } from '../../../core/services/mascota.service';
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

import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
export type Vista = 'lista' | 'dia' | 'semana' | 'mes';

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

    ConfirmDialogModule,
    ToastModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './agenda.component.html'
})
export class AgendaComponent implements OnInit {
  private readonly fb                = inject(FormBuilder);
  private readonly citaService       = inject(CitaService);
  private readonly empleadoService   = inject(EmpleadoService);
  private readonly apoderadoService  = inject(ApoderadoService);
  private readonly mascotaService    = inject(MascotaService);
  private readonly companyService    = inject(CompanyService);
  private readonly servicioService   = inject(ServicioService);
  private readonly pagoService       = inject(PagoService);
  private readonly messageService    = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router            = inject(Router);
  readonly authStore                 = inject(AuthStore);
  readonly loadingStore              = inject(LoadingStore);

  readonly isSuperAdmin = computed(() => this.authStore.roles().includes(Role.SUPER_ADMIN));
  readonly isAdmin      = computed(() => this.authStore.roles().includes(Role.ADMIN));
  readonly canManage    = computed(() => this.isAdmin() || this.isSuperAdmin());

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
    const total = this.totalCita();
    return total === 0 || recibido >= total / 2;
  });
  citas            = signal<CitaResponse[]>([]);
  totalRecords     = signal<number>(0);
  displayModal     = signal<boolean>(false);
  displayCancelModal = signal<boolean>(false);
  displayDeleteModal = signal<boolean>(false);
  displayCajaModal   = signal<boolean>(false);
  citaParaPago       = signal<CitaResponse | null>(null);
  metodoPago         = signal<MetodoPago>('EFECTIVO');
  montoRecibido      = signal<number | null>(null);
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
  servicios           = signal<{ label: string; value: number; precio: number }[]>([]);
  showClienteSelector = signal<boolean>(false);
  clienteSearch       = signal<string>('');
  filteredClientes    = computed(() => {
    const search = this.clienteSearch().toLowerCase();
    return this.clientes().filter(c => c.label.toLowerCase().includes(search));
  });

  selectedClienteLabel = signal<string>('Seleccionar dueño...');
  selectedMascotaLabel = signal<string>('Seleccionar mascota...');
  showMascotaSelector  = signal<boolean>(false);
  showVeterinarioSelector = signal<boolean>(false);
  showServicioSelector = signal<boolean>(false);
  showEstadoFilter = signal<boolean>(false);
  showVeterinarioFilter = signal<boolean>(false);
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
  cargandoCal  = signal<boolean>(false);

  readonly HORAS_DIA = Array.from({ length: 15 }, (_, i) => i + 7);

  getVeterinarioLabel(): string {
    const id = this.citaForm.get('veterinarioId')?.value;
    return this.veterinarios().find(v => v.value === id)?.label ?? 'Seleccionar médico';
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
    this.loadCitas();
  }

  getVeterinarioFilterLabel(): string {
    if (!this.filterVeterinarioId) return 'Todos';
    return this.veterinarios().find(v => v.value === this.filterVeterinarioId)?.label ?? 'Todos';
  }

  setVeterinarioFilter(value: number | null) {
    this.filterVeterinarioId = value;
    this.showVeterinarioFilter.set(false);
    this.loadCitas();
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
    motivoCita:      ['',   [Validators.required]],
    fechaHoraInicio: [null, [Validators.required, this.horariosValidator]],
    servicioId:      [null],
    notas:           [''],
    esEmergencia:    [false]
  });

  ngOnInit() {
    this.loadCitas();
    this.loadServicios();
    this.loadVeterinarios();
    this.loadClientes();
    this.loadAllMascotas();
    this.citaForm.get('esEmergencia')?.valueChanges.subscribe(() => {
      this.citaForm.get('fechaHoraInicio')?.updateValueAndValidity();
    });
  }

  loadCitas(event: any = { first: 0, rows: 10 }) {
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.citas.set([]);
      this.totalRecords.set(0);
      return;
    }

    const page      = Math.floor(event.first / event.rows);
    const fechaStr  = this.filterFecha || undefined;
    let veterinarioId = this.filterVeterinarioId || undefined;
    if (this.authStore.roles().includes('ROLE_VETERINARIO') && !this.isSuperAdmin()) {
      veterinarioId = this.authStore.empleadoId() ?? undefined;
    }

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
        this.totalRecords.set(res.data.totalElements);
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
            .filter((e: any) => e.tiposEmpleado && e.tiposEmpleado.some((t: any) => 
              (typeof t === 'string' ? t : t.nombre).toUpperCase() === 'VETERINARIO'
            ))
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
          res.data.content.map(c => ({ label: `${c.nombre} ${c.apellido}`, value: c.id }))
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

  onClienteChange(cliente: {label: string, value: number}) {
    this.selectedClienteLabel.set(cliente.label);
    this.showClienteSelector.set(false);
    this.filteredMascotas.set(
      this.allMascotas()
        .filter(m => m.apoderadoId === cliente.value)
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
  }

  selectServicio(srv: {label: string, value: number} | null) {
    this.citaForm.get('servicioId')?.setValue(srv?.value ?? null);
    this.showServicioSelector.set(false);
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
    this.citaForm.reset({ esEmergencia: false });
    this.selectedClienteLabel.set('Seleccionar dueño...');
    this.selectedMascotaLabel.set('Seleccionar mascota...');
    this.filteredMascotas.set([]);
    this.isReprogramando.set(false);
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

    this.citaForm.patchValue({
      id: cita.id,
      version: cita.version,
      mascotaId: cita.mascotaId,
      veterinarioId: cita.veterinarioId,
      motivoCita: cita.motivoCita,
      fechaHoraInicio: cita.fechaHoraInicio.substring(0, 16),
      servicioId: cita.servicioId,
      notas: cita.notas,
      esEmergencia: cita.esEmergencia
    });
    this.displayModal.set(true);
  }

  saveCita() {
    if (this.citaForm.invalid) {
      this.citaForm.markAllAsTouched();
      if (this.citaForm.get('fechaHoraInicio')?.hasError('fuera-de-horario')) {
        this.messageService.add({ severity: 'warn', summary: 'Horario no disponible', detail: this.mensajeHorario });
      }
      return;
    }
    const formValue = this.citaForm.value;
    let localIsoString = formValue.fechaHoraInicio;
    if (formValue.fechaHoraInicio instanceof Date) {
      const date = formValue.fechaHoraInicio;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      localIsoString = `${year}-${month}-${day}T${hours}:${minutes}:00`;
    }

    const request: CitaRequest = {
      ...formValue,
      fechaHoraInicio: localIsoString
    };
    
    const id = this.citaForm.get('id')?.value;
    const observer = {
      next: () => {
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
    if (cita.estado === EstadoCita.COMPLETADA || cita.estado === EstadoCita.CANCELADA || cita.estado === EstadoCita.EN_PROCESO) {
      return false;
    }
    const fechaInicio = new Date(cita.fechaHoraInicio);
    const ahora = new Date();
    const diferenciaMs = fechaInicio.getTime() - ahora.getTime();
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    
    return diferenciaHoras >= 1;
  }

  canEdit(cita: CitaResponse): boolean {
    if (cita.estado === EstadoCita.COMPLETADA || cita.estado === EstadoCita.CANCELADA || cita.estado === EstadoCita.EN_PROCESO) {
      return false;
    }
    const fechaInicio = new Date(cita.fechaHoraInicio);
    const ahora = new Date();
    const diferenciaMs = fechaInicio.getTime() - ahora.getTime();
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    
    return diferenciaHoras >= 1;
  }

  iniciarCita(cita: CitaResponse) {
    this.loadingStore.show();
    this.citaService.iniciarAtencion(cita.id).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Atención iniciada' });
        this.loadingStore.hide();
        this.router.navigate(['/historias-clinicas/consulta', res.data]);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al iniciar atención' });
        this.loadingStore.hide();
      }
    });
  }

  cancelarCita(cita: CitaResponse) {
    if (!this.canCancel(cita)) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Restricción', 
        detail: 'No se puede cancelar citas con menos de 1 hora de anticipación' 
      });
      return;
    }
    this.selectedCita.set(cita);
    this.cancelMotivo.set('');
    this.cancelMotivoAttempted.set(false);
    this.displayCancelModal.set(true);
  }

  eliminarCita(cita: CitaResponse) {
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

  confirmarCancelacion() {
    const cita = this.selectedCita();
    const motivo = this.cancelMotivo();
    
    if (!cita) return;
    if (!motivo || motivo.trim() === '') {
      this.cancelMotivoAttempted.set(true);
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Debe ingresar un motivo para cancelar' });
      return;
    }

    this.cancelMotivoAttempted.set(false);

    this.loadingStore.show();
    this.citaService.cancelarCita(cita.id, motivo).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Cita cancelada' });
        this.displayCancelModal.set(false);
        this.loadCitas();
        if (this.vistaActual() !== 'lista') this.loadCitasCalendario();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cancelar la cita' });
        this.loadingStore.hide();
      }
    });
  }

  continuarConsulta(cita: CitaResponse) {
    if (cita.consultaId) {
      this.router.navigate(['/historias-clinicas/consulta', cita.consultaId]);
    } else {
      this.loadingStore.show();
      this.citaService.iniciarAtencion(cita.id).subscribe({
        next: (res) => {
          this.loadingStore.hide();
          this.router.navigate(['/historias-clinicas/consulta', res.data]);
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
      default:                        return 'bg-slate-400';
    }
  }

  cambiarVista(vista: Vista) {
    this.vistaActual.set(vista);
    if (vista === 'lista' || vista === 'dia') {
      this.loadCitas();
    } else {
      this.loadCitasCalendario();
    }
  }

  navegarCalendario(dir: -1 | 1) {
    const base = new Date(this.fechaBase());
    const v = this.vistaActual();
    if (v === 'dia') {
      base.setDate(base.getDate() + dir);
      this.filterFecha = this.toDateStr(base);
      this.loadCitas();
    } else if (v === 'semana') {
      base.setDate(base.getDate() + dir * 7);
      this.loadCitasCalendario();
    } else {
      base.setMonth(base.getMonth() + dir);
      this.loadCitasCalendario();
    }
    this.fechaBase.set(base);
  }

  irAHoy() {
    const hoy = new Date();
    this.fechaBase.set(hoy);
    this.filterFecha = this.toDateStr(hoy);
    if (this.vistaActual() === 'lista' || this.vistaActual() === 'dia') {
      this.loadCitas();
    } else {
      this.loadCitasCalendario();
    }
  }

  loadCitasCalendario() {
    const companyId = this.activeCompanyId ?? undefined;
    if (!companyId) { this.citasPorDia.set({}); return; }
    const dias = this.vistaActual() === 'semana' ? this.diasSemanaActual() : this.diasMesActual();
    const fechas = [...new Set(dias.map(d => this.toDateStr(d)))];

    this.cargandoCal.set(true);
    forkJoin(
      fechas.map(fecha =>
        this.citaService.listar(companyId, fecha, undefined, undefined, 0, 50).pipe(
          map(res => ({ fecha, citas: res.data.content })),
          catchError(() => of({ fecha, citas: [] as CitaResponse[] }))
        )
      )
    ).subscribe(results => {
      const mapa: Record<string, CitaResponse[]> = {};
      results.forEach(r => (mapa[r.fecha] = r.citas));
      this.citasPorDia.set(mapa);
      this.cargandoCal.set(false);
    });
  }

  canCobrar(cita: CitaResponse): boolean {
    if (!cita.servicioId) return false;
    if (cita.estado === EstadoCita.CANCELADA || cita.estado === EstadoCita.NO_ASISTIO) return false;
    const total = cita.totalServicio ?? 0;
    const pagado = cita.montoPagado ?? 0;
    return total <= 0 || pagado < total;
  }

  abrirCaja(cita: CitaResponse) {
    this.citaParaPago.set(cita);
    this.metodoPago.set('EFECTIVO');
    this.montoRecibido.set(null);
    this.displayCajaModal.set(true);
  }

  confirmarPago() {
    const cita = this.citaParaPago();
    if (!cita) return;

    if (this.metodoPago() === 'EFECTIVO') {
      if (!this.esPagoValido()) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Monto insuficiente',
          detail: `El mínimo aceptado es S/ ${(this.totalCita() / 2).toFixed(2)} (50% del total)`
        });
        return;
      }
    }

    const request: PagoRequest = {
      citaId: cita.id,
      metodoPago: this.metodoPago(),
      ...(this.metodoPago() === 'EFECTIVO' ? { montoRecibido: this.montoRecibido() ?? 0 } : {})
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
