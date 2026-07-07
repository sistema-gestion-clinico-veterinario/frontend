import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CalendarModule } from 'primeng/calendar';
import { MessageService } from 'primeng/api';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { PagoService } from '../../../core/services/pago.service';
import { AuthStore } from '../../../store/auth.store';
import { LoadingStore } from '../../../store/loading.store';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';

interface HorarioResumen {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  rangoFechas: string;
  totalFechas: number;
}

@Component({
  selector: 'app-apoderado-citas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    PaginatorModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    ToastModule,
    CalendarModule,
    RouterModule
  ],
  providers: [MessageService],
  templateUrl: './citas.component.html',
  styleUrl: './citas.component.scss'
})
export class CitasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly pagoService = inject(PagoService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private loadTimeout: any = null;

  // Lists & Signals
  mascotas = signal<any[]>([]);
  citas = signal<any[]>([]);
  servicios = signal<any[]>([]);
  vets = signal<any[]>([]);
  availableSlots = signal<string[]>([]);
  horariosVeterinario = signal<any[]>([]);
  companyPhone = signal<string>('');
  isCurrentlyOpen = signal<boolean>(true);

  // Dropdown options for pet filter
  petFilterOptions = computed(() => {
    const pets = this.mascotas();
    return [
      { label: 'Todas las mascotas', value: null, initial: 'T' },
      ...pets.map((m: any) => ({
        label: m.nombreCompleto,
        value: m.id,
        initial: (m.nombreCompleto || '?').charAt(0).toUpperCase()
      }))
    ];
  });

  // Computed stats
  activeCitasCount = computed(() => this.citas().filter(c => c.estado === 'PENDIENTE' || c.estado === 'CONFIRMADA' || c.estado === 'PROGRAMADA' || c.estado === 'REPROGRAMADA').length);
  completedCitasCount = computed(() => this.citas().filter(c => c.estado === 'COMPLETADA' || c.estado === 'ATENDIDA').length);
  pendingPaymentCount = computed(() => this.citas().filter(c => this.canPagar(c)).length);
  
  // View Modes & Filters
  citasViewMode = signal<'list' | 'grid'>('list');
  selectedPetFilter = signal<number | null>(null);
  loadingSlots = signal<boolean>(false);
  today = new Date();

  // Pagination
  currentPage = signal<number>(0);
  totalRecords = signal<number>(0);
  pageSize = signal<number>(10);

  // Modals & States
  displayCitaModal = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  isRescheduling = signal<boolean>(false);
  editingCitaId = signal<number | null>(null);
  displayConfirmModal = signal<boolean>(false);
  confirmMsg = signal<string>('');
  confirmHeader = signal<string>('');
  private pendingRequest: any = null;

  // ── PAGO YAPE ──────────────────────────────────────────────────
  displayPagoModal = signal<boolean>(false);
  citaPendientePago = signal<any | null>(null);
  yapePhone         = signal<string>('');
  yapeOtp           = signal<string>('');
  yapeEmail         = signal<string>('');
  pagoProcessing    = signal<boolean>(false);

  onYapePhoneChange(val: string) { this.yapePhone.set(val.replace(/\D/g, '').slice(0, 9)); }
  onYapeOtpChange(val: string)   { this.yapeOtp.set(val.replace(/\D/g, '').slice(0, 6)); }

  // ── PAGO – helpers ─────────────────────────────────────────────
  /** Muestra el botón "Pagar" si la cita está ATENDIDA y no tiene pago registrado */
  canPagar(cita: any): boolean {
    if (!cita) return false;
    const pagableStates = ['ATENDIDA', 'EN_PROCESO', 'COMPLETADA'];
    return pagableStates.includes(cita.estado) && !cita.montoPagado;
  }

  openPagoModal(cita: any) {
    this.citaPendientePago.set(cita);
    this.yapePhone.set('');
    this.yapeOtp.set('');
    // Pre-llenar con el email del apoderado autenticado
    this.yapeEmail.set(this.authStore.nombreCompleto() ? (this.authStore as any).email?.() ?? '' : '');
    this.displayPagoModal.set(true);
  }

  closePagoModal() {
    this.displayPagoModal.set(false);
    this.citaPendientePago.set(null);
    this.yapePhone.set('');
    this.yapeOtp.set('');
    this.yapeEmail.set('');
  }

  confirmarPagoYape() {
    const cita = this.citaPendientePago();
    if (!cita) return;

    const phone = this.yapePhone().trim();
    const otp   = this.yapeOtp().trim();
    const email = this.yapeEmail().trim();

    if (phone.length !== 9) {
      this.messageService.add({ severity: 'warn', summary: 'Teléfono inválido', detail: 'El número Yape debe tener exactamente 9 dígitos.' });
      return;
    }
    if (otp.length !== 6) {
      this.messageService.add({ severity: 'warn', summary: 'OTP inválido', detail: 'El código OTP debe tener exactamente 6 dígitos.' });
      return;
    }
    if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
      this.messageService.add({ severity: 'warn', summary: 'Email invalido', detail: 'Ingresa un correo valido en minusculas para completar el pago.' });
      return;
    }

    this.pagoProcessing.set(true);

    this.pagoService.registrar({
      citaId: cita.id,
      metodoPago: 'YAPE',
      yapePhoneNumber: Number(phone),
      yapeOtp: Number(otp),
      payerEmail: email
    }).subscribe({
      next: () => {
        this.pagoProcessing.set(false);
        this.messageService.add({
          severity: 'success',
          summary: '¡Pago exitoso!',
          detail: 'Tu pago con Yape fue procesado correctamente.'
        });
        this.closePagoModal();
        this.loadCitas();
      },
      error: (err: any) => {
        this.pagoProcessing.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error en el pago',
          detail: err.error?.message || 'No se pudo procesar el pago Yape. Verifica el número y el código OTP.'
        });
      }
    });
  }
  // ───────────────────────────────────────────────────────────────

  citaForm: FormGroup = this.fb.group({
    mascotaId: [null, [Validators.required]],
    servicioId: [null, [Validators.required]],
    veterinarioId: [null, [Validators.required]],
    fechaCita: [null, [Validators.required]],
    horaCita: [null, [Validators.required]],
    motivoCita: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    notas: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]]
  });

  ngOnInit() {
    const mascotaId = Number(this.route.snapshot.queryParamMap.get('mascotaId'));
    if (mascotaId) this.selectedPetFilter.set(mascotaId);
    this.loadInitialData();
  }

  loadInitialData() {
    this.loadingStore.show();
    this.loadMascotas();
    this.loadCitas();
    this.loadPortalServices();
    this.loadCompanyInfo();
  }

  private loadCompanyInfo() {
    this.apoderadoService.getPortalPerfil().subscribe({
      next: (res) => {
        const data = res.data as any;
        if (data) {
          this.companyPhone.set(data.companyPhone ?? '');
          this.isCurrentlyOpen.set(data.currentlyOpen !== false);
        }
      }
    });
  }

  loadMascotas() {
    this.apoderadoService.getPortalMascotas().subscribe({
      next: (res) => this.mascotas.set(res.data),
      error: (err: any) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar sus mascotas.' })
    });
  }

  loadCitas() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }
    this.loadTimeout = setTimeout(() => {
      this.executeLoadCitas();
    }, 50);
  }

  private executeLoadCitas() {
    const filterId = this.selectedPetFilter();
    const page = this.currentPage();
    const size = this.pageSize();
    this.apoderadoService.getPortalCitasFiltradas(filterId || undefined, page, size).subscribe({
      next: (res) => {
        const data = res.data;
        this.citas.set(data?.content ?? []);
        this.totalRecords.set(data?.page?.totalElements ?? data?.totalElements ?? 0);
        this.loadingStore.hide();
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar sus citas médicas.' });
        this.loadingStore.hide();
      }
    });
  }

  onPageChange(event: any) {
    this.currentPage.set(event.page ?? 0);
    this.pageSize.set(event.rows ?? 10);
    this.loadCitas();
  }

  filterCitasByPet(petId: number | null) {
    this.selectedPetFilter.set(petId);
    this.loadCitas();
  }

  onPetFilterChange(event: any) {
    this.loadCitas();
  }

  loadPortalServices() {
    this.apoderadoService.getPortalServicios().subscribe({
      next: (res) => {
        const servList = res.data.map((s: any) => ({
          label: `${s.nombre} - S/. ${s.precio.toFixed(2)}`,
          value: s.id
        }));
        this.servicios.set(servList);
      }
    });
  }

  onServiceChange(servicioId: any, skipReset: boolean = false) {
    if (!skipReset) {
      this.citaForm.patchValue({
        veterinarioId: null,
        fechaCita: null,
        horaCita: null
      });
      this.availableSlots.set([]);
      this.horariosVeterinario.set([]);
    }

    if (!servicioId || servicioId === 'null') {
      this.vets.set([]);
      return;
    }

    const id = Number(servicioId);
    this.apoderadoService.getPortalEmpleados(id).subscribe({
      next: (res) => {
        const vetList = res.data.map((emp: any) => ({
          label: `${emp.nombre} ${emp.apellido}`,
          value: emp.id
        }));
        this.vets.set(vetList);
      }
    });
  }

  onBookingParamsChange() {
    const val = this.citaForm.value;
    if (!val.servicioId || !val.veterinarioId || !val.fechaCita) {
      this.availableSlots.set([]);
      this.citaForm.patchValue({ horaCita: null });
      return;
    }

    this.loadingSlots.set(true);
    this.availableSlots.set([]);
    this.citaForm.patchValue({ horaCita: null });

    const fechaStr = this.toDateInputValue(val.fechaCita);

    this.apoderadoService.getPortalDisponibilidad(val.veterinarioId, fechaStr, val.servicioId).subscribe({
      next: (res) => {
        this.availableSlots.set(res.data || []);
        this.loadingSlots.set(false);
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo obtener la disponibilidad del profesional.' });
        this.loadingSlots.set(false);
      }
    });
  }

  selectTimeSlot(slot: string) {
    this.citaForm.patchValue({ horaCita: slot });
  }

  onVeterinarioChange() {
    const veterinarioId = Number(this.citaForm.get('veterinarioId')?.value);
    this.onBookingParamsChange();

    if (!veterinarioId) {
      this.horariosVeterinario.set([]);
      return;
    }

    this.apoderadoService.getPortalEmpleadoHorario(veterinarioId).subscribe({
      next: (res) => this.horariosVeterinario.set(this.sortHorarios(res.data || [])),
      error: () => this.horariosVeterinario.set([])
    });
  }

  openNuevaCita() {
    this.isEditing.set(false);
    this.isRescheduling.set(false);
    this.editingCitaId.set(null);
    this.vets.set([]);
    this.availableSlots.set([]);
    this.horariosVeterinario.set([]);
    this.citaForm.get('servicioId')?.enable();
    this.citaForm.get('veterinarioId')?.enable();
    this.citaForm.get('fechaCita')?.enable();
    this.citaForm.get('horaCita')?.enable();
    const defaultMascotaId = this.selectedPetFilter() ?? (this.mascotas().length > 0 ? this.mascotas()[0].id : null);
    this.citaForm.reset({
      mascotaId: defaultMascotaId,
      servicioId: null,
      veterinarioId: null,
      fechaCita: null,
      horaCita: null,
      motivoCita: '',
      notas: ''
    });
    this.displayCitaModal.set(true);
  }

  private toUtc5Ms(dateStr: string): number {
    return new Date(dateStr + '-05:00').getTime();
  }

  private nowUtc5Ms(): number {
    return new Date().getTime();
  }

  canUpdateDetails(cita: any): boolean {
    if (!cita) return false;
    if (!this.authStore.hasAccess('VISTA_MIS_CITAS', 'modificar')) return false;
    const editableStates = ['PENDIENTE', 'CONFIRMADA', 'PROGRAMADA', 'REPROGRAMADA'];
    if (!editableStates.includes(cita.estado)) return false;
    const diffMs = this.toUtc5Ms(cita.fechaHoraInicio) - this.nowUtc5Ms();
    return diffMs >= 4 * 60 * 60 * 1000;
  }

  canReschedule(cita: any): boolean {
    if (!cita) return false;
    const editableStates = ['PENDIENTE', 'CONFIRMADA', 'PROGRAMADA', 'REPROGRAMADA'];
    if (!editableStates.includes(cita.estado)) return false;
    const diffMs = this.toUtc5Ms(cita.fechaHoraInicio) - this.nowUtc5Ms();
    return diffMs >= 6 * 60 * 60 * 1000;
  }

  canCancel(cita: any): boolean {
    return false;
  }

  cancelCita(cita: any) {
    this.messageService.add({ severity: 'warn', summary: 'Restricción', detail: 'No se puede cancelar la cita con menos de 2 horas de anticipación.' });
  }

  editCitaDetails(cita: any) {
    this.isEditing.set(true);
    this.isRescheduling.set(false);
    this.editingCitaId.set(cita.id);
    
    this.onServiceChange(cita.servicioId, true);

    this.citaForm.reset({
      mascotaId: cita.mascotaId,
      servicioId: cita.servicioId,
      veterinarioId: cita.veterinarioId,
      fechaCita: this.toDateInputValue(cita.fechaHoraInicio),
      horaCita: new Date(cita.fechaHoraInicio).toTimeString().substring(0, 5),
      motivoCita: cita.motivoCita,
      notas: cita.notas || ''
    });

    this.citaForm.get('servicioId')?.disable();
    this.citaForm.get('veterinarioId')?.disable();
    this.citaForm.get('fechaCita')?.disable();
    this.citaForm.get('horaCita')?.disable();

    this.displayCitaModal.set(true);
  }

  rescheduleCita(cita: any) {
    this.isEditing.set(false);
    this.isRescheduling.set(true);
    this.editingCitaId.set(cita.id);
    
    this.onServiceChange(cita.servicioId, true);
    this.availableSlots.set([]);
    this.horariosVeterinario.set([]);
    this.citaForm.get('servicioId')?.enable();
    this.citaForm.get('veterinarioId')?.enable();
    this.citaForm.get('fechaCita')?.enable();
    this.citaForm.get('horaCita')?.enable();

    this.citaForm.reset({
      mascotaId: cita.mascotaId,
      servicioId: cita.servicioId,
      veterinarioId: cita.veterinarioId,
      fechaCita: null,
      horaCita: null,
      motivoCita: cita.motivoCita,
      notas: cita.notas || ''
    });

    this.onVeterinarioChange();
    this.displayCitaModal.set(true);
  }

  getPetName(id: any): string {
    const pet = this.mascotas().find(m => m.id === Number(id));
    return pet ? pet.nombreCompleto : 'Cargando...';
  }

  getServiceName(id: any): string {
    const service = this.servicios().find(s => s.value === Number(id));
    return service ? service.label : 'Cargando...';
  }

  saveCita() {
    if (this.citaForm.invalid) {
      this.citaForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Formulario Inválido', detail: 'Por favor, complete todos los campos obligatorios.' });
      return;
    }

    const formVal = this.citaForm.getRawValue();

    let isoString = '';
    if (!this.isEditing()) {
      const fechaStr = this.toDateInputValue(formVal.fechaCita);
      const timeStr = formVal.horaCita; 
      
      isoString = `${fechaStr}T${timeStr}:00`;
    }

    if (!this.isEditing() && new Date(isoString).getTime() < Date.now() - 60_000) {
      this.messageService.add({ severity: 'warn', summary: 'Fecha invalida', detail: 'La fecha de la cita no puede estar en el pasado.' });
      this.loadingStore.hide();
      return;
    }

    const originalCita = this.editingCitaId() ? this.citas().find(c => c.id === this.editingCitaId()) : null;
    const request = {
      mascotaId: Number(formVal.mascotaId),
      veterinarioId: Number(formVal.veterinarioId),
      servicioId: Number(formVal.servicioId),
      fechaHoraInicio: this.isEditing() && originalCita ? originalCita.fechaHoraInicio : isoString,
      motivoCita: formVal.motivoCita,
      notas: formVal.notas,
      esEmergencia: originalCita ? originalCita.esEmergencia : false
    };

    this.pendingRequest = request;
    this.confirmHeader.set(this.isEditing() ? 'Confirmar Edición' : this.isRescheduling() ? 'Confirmar Reprogramación' : 'Confirmar Cita');
    this.confirmMsg.set(this.isEditing() ? 'Se actualizarán los datos de la cita.' : this.isRescheduling() ? 'Se reprogramará la cita.' : 'Se agendará una nueva cita.');
    this.displayConfirmModal.set(true);
  }

  onConfirmAccept() {
    this.displayConfirmModal.set(false);
    const req = this.pendingRequest;
    this.pendingRequest = null;
    if (req) this.executeSaveCita(req);
  }

  onConfirmReject() {
    this.displayConfirmModal.set(false);
    this.pendingRequest = null;
  }

  private executeSaveCita(request: any) {
    this.loadingStore.show();
    if (this.isEditing()) {
      this.apoderadoService.updatePortalCita(this.editingCitaId()!, request).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: '¡Los detalles de la cita se actualizaron con éxito!' });
          this.displayCitaModal.set(false);
          this.loadCitas();
        },
        error: (err: any) => {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Error al Actualizar', 
            detail: err.error?.message || 'No se pudieron actualizar los detalles de la cita.' 
          });
          this.loadingStore.hide();
        }
      });
    } else if (this.isRescheduling()) {
      this.apoderadoService.reschedulePortalCita(this.editingCitaId()!, request).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: '¡La cita se reprogramó con éxito!' });
          this.displayCitaModal.set(false);
          this.loadCitas();
        },
        error: (err: any) => {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Error al Reprogramar', 
            detail: err.error?.message || 'No se pudo reprogramar la cita.' 
          });
          this.loadingStore.hide();
        }
      });
    } else {
      this.apoderadoService.crearPortalCita(request).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: '¡La cita médica se agendó con éxito!' });
          this.displayCitaModal.set(false);
          this.loadCitas();
        },
        error: (err: any) => {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Error al Agendar', 
            detail: err.error?.message || 'El profesional seleccionado no está disponible en la franja horaria elegida.' 
          });
          this.loadingStore.hide();
        }
      });
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CONFIRMADA': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'EN_ATENCION': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'COMPLETADA': return 'bg-green-50 text-green-700 border-green-200';
      case 'CANCELADA': return 'bg-red-50 text-red-700 border-red-200';
      case 'ELIMINADA': return 'bg-slate-100 text-slate-400 border-slate-200';
      case 'ATENDIDA': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'EN_PROCESO': return 'bg-violet-50 text-violet-700 border-violet-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  getEstadoDotClass(estado: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'bg-amber-400';
      case 'CONFIRMADA': return 'bg-blue-400';
      case 'EN_ATENCION': return 'bg-purple-400';
      case 'COMPLETADA': return 'bg-green-400';
      case 'CANCELADA': return 'bg-red-400';
      case 'ELIMINADA': return 'bg-slate-300';
      case 'ATENDIDA': return 'bg-emerald-400';
      case 'EN_PROCESO': return 'bg-violet-400';
      default: return 'bg-slate-400';
    }
  }

  get selectedVetName(): string {
    const id = Number(this.citaForm.get('veterinarioId')?.value);
    return this.vets().find(v => Number(v.value) === id)?.label ?? 'Profesional seleccionado';
  }

  get horariosActivos(): any[] {
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

  private buildHorarioResumen(horarios: any[]): HorarioResumen[] {
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

  private sortHorarios(horarios: any[]): any[] {
    const order = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    return [...horarios].sort((a, b) => {
      const fechaCmp = String(a.fecha ?? '').localeCompare(String(b.fecha ?? ''));
      if (fechaCmp !== 0) return fechaCmp;
      const dayCmp = order.indexOf(a.diaSemana) - order.indexOf(b.diaSemana);
      if (dayCmp !== 0) return dayCmp;
      return String(a.horaInicio ?? '').localeCompare(String(b.horaInicio ?? ''));
    });
  }

  toDateInputValue(value: string | Date): string {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return String(value).substring(0, 10);
  }
}
