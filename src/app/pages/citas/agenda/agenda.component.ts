import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputTextarea } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CitaService } from '../../../core/services/cita.service';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MascotaService } from '../../../core/services/mascota.service';
import { CompanyService } from '../../../core/services/company.service';
import { ServicioService } from '../../../core/services/servicio.service';
import { ServicioResponse } from '../../../models/response/servicio-response';
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

    ToastModule
  ],
  providers: [MessageService],
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
  private readonly messageService    = inject(MessageService);
  private readonly router            = inject(Router);
  readonly authStore                 = inject(AuthStore);
  readonly loadingStore              = inject(LoadingStore);

  readonly isSuperAdmin = computed(() => this.authStore.roles().includes(Role.SUPER_ADMIN));

  // Data
  citas            = signal<CitaResponse[]>([]);
  totalRecords     = signal<number>(0);
  displayModal     = signal<boolean>(false);
  veterinarios     = signal<{ label: string; value: number }[]>([]);
  clientes         = signal<{ label: string; value: number }[]>([]);
  allMascotas      = signal<MascotaResponse[]>([]);
  filteredMascotas = signal<{ label: string; value: number }[]>([]);
  empresas         = signal<{ label: string; value: number }[]>([]);
  horariosVeterinario = signal<HorarioEmpleadoResponse[]>([]);
  servicios           = signal<{ label: string; value: number; precio: number }[]>([]);

  // Filtros
  filterFecha: string             = new Date().toISOString().split('T')[0];
  filterEstado: EstadoCita | null = null;
  filterVeterinarioId: number | null = null;
  selectedCompanyId: number | null   = null;
  filtersOpen                        = false;

  // ── Vista calendario ───────────────────────────────────────────
  vistaActual  = signal<Vista>('lista');
  fechaBase    = signal<Date>(new Date());
  citasPorDia  = signal<Record<string, CitaResponse[]>>({});
  cargandoCal  = signal<boolean>(false);

  readonly HORAS_DIA = Array.from({ length: 15 }, (_, i) => i + 7);

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

  // Validador personalizado para el horario
  horariosValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    
    const fecha = control.value as Date;
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
    notas:           ['']
  });

  ngOnInit() {
    if (this.isSuperAdmin()) {
      this.loadEmpresas();
    } else {
      this.loadCitas();
      this.loadServicios();
    }
    this.loadVeterinarios();
    this.loadClientes();
    this.loadAllMascotas();
  }

  loadEmpresas() {
    this.companyService.listar(0, 100).subscribe({
      next: (res) => {
        this.empresas.set(
          res.data.content
            .filter(c => c.activo)
            .map(c => ({ label: c.name, value: c.id }))
        );
      }
    });
  }

  onEmpresaChange() {
    const companyId = this.selectedCompanyId ?? undefined;
    this.loadCitas();
    this.loadVeterinarios(companyId);
    this.loadClientes(companyId);
    this.loadAllMascotas(companyId);
    this.loadServicios(companyId);
    this.citaForm.reset();
    this.filteredMascotas.set([]);
  }

  loadCitas(event: any = { first: 0, rows: 10 }) {
    if (this.isSuperAdmin() && !this.selectedCompanyId) {
      this.citas.set([]);
      this.totalRecords.set(0);
      return;
    }

    const page      = Math.floor(event.first / event.rows);
    const fechaStr  = this.filterFecha || undefined;
    const companyId = this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined;
    
    // Si es veterinario y no es SuperAdmin, filtrar por su propio ID de empleado
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
    const targetCompanyId = companyId || (this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined);
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
    const targetCompanyId = companyId || (this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined);
    this.apoderadoService.listar(targetCompanyId, undefined, undefined, 0, 100).subscribe({
      next: (res) => {
        this.clientes.set(
          res.data.content.map(c => ({ label: `${c.nombre} ${c.apellido}`, value: c.id }))
        );
      }
    });
  }

  loadAllMascotas(companyId?: number) {
    const targetCompanyId = companyId || (this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined);
    this.mascotaService.listar(targetCompanyId, undefined, undefined, 0, 500).subscribe({
      next: (res) => this.allMascotas.set(res.data.content)
    });
  }

  loadServicios(companyId?: number) {
    const targetCompanyId = companyId ?? (this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined);
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

  onClienteChange(clienteId: number) {
    this.filteredMascotas.set(
      this.allMascotas()
        .filter(m => m.apoderadoId === clienteId)
        .map(m => ({ label: m.nombreCompleto, value: m.id }))
    );
    this.citaForm.get('mascotaId')?.setValue(null);
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
        // Actualizar validadores de fecha cuando cambia el horario
        this.citaForm.get('fechaHoraInicio')?.updateValueAndValidity();
      },
      error: () => {
        this.horariosVeterinario.set([]);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el horario del veterinario' });
      }
    });
  }

  // Validar que la fecha/hora esté dentro del horario disponible
  isTimeInHorario(fecha: Date): boolean {
    if (!fecha) return false;

    const horarios = this.horariosVeterinario();
    if (horarios.length === 0) return false;

    const dayOfWeek = fecha.getDay();
    const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const diaActual = diasSemana[dayOfWeek];
    const horarioDelDia = horarios.find(h => h.diaSemana === diaActual);
    if (!horarioDelDia) return false;

    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const timeSeleccionada = `${horas}:${minutos}`;

    return timeSeleccionada >= horarioDelDia.horaInicio && timeSeleccionada < horarioDelDia.horaFin;
  }

  openNew() {
    this.citaForm.reset();
    this.filteredMascotas.set([]);
    this.displayModal.set(true);
  }

  editarCita(cita: CitaResponse) {
    this.citaForm.patchValue({
      id: cita.id,
      version: cita.version,
      mascotaId: cita.mascotaId,
      veterinarioId: cita.veterinarioId,
      motivoCita: cita.motivoCita,
      fechaHoraInicio: new Date(cita.fechaHoraInicio),
      servicioId: cita.servicioId,
      notas: cita.notas
    });
    this.displayModal.set(true);
  }

  saveCita() {
    if (this.citaForm.invalid) {
      this.citaForm.markAllAsTouched();
      return;
    }
    const formValue = this.citaForm.value;
    const date = formValue.fechaHoraInicio as Date;
    // Formatear a ISO local (YYYY-MM-DDTHH:mm:ss) para preservar la hora seleccionada
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const localIsoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

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

    this.loadingStore.show();
    if (id) {
      this.citaService.actualizar(id, request).subscribe(observer);
    } else {
      this.citaService.crear(request).subscribe(observer);
    }
  }

  iniciarCita(cita: CitaResponse) {
    this.loadingStore.show();
    this.citaService.iniciarAtencion(cita.id).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Atención iniciada' });
        this.loadingStore.hide();
        // Navegar usando la ruta absoluta completa
        this.router.navigate(['/historias-clinicas/consulta', res.data]);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al iniciar atención' });
        this.loadingStore.hide();
      }
    });
  }

  continuarConsulta(cita: CitaResponse) {
    if (cita.consultaId) {
      this.router.navigate(['/historias-clinicas/consulta', cita.consultaId]);
    } else {
      // Fallback: si no tiene el ID en la lista, intentamos recuperarlo del servidor
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

  // ── Métodos calendario ─────────────────────────────────────────
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
    if (this.isSuperAdmin() && !this.selectedCompanyId) { this.citasPorDia.set({}); return; }
    const companyId = this.isSuperAdmin() ? (this.selectedCompanyId ?? undefined) : undefined;
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

  toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }
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
