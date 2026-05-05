import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { CitaResponse } from '../../../models/response/cita-response';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { CitaRequest } from '../../../models/request/cita-request';
import { EstadoCita } from '../../../core/enums/estado-cita.enum';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { Role } from '../../../core/enums/role.enum';
import { Router } from '@angular/router';

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
    InputTextarea,
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

  // Filtros
  filterFecha: string             = new Date().toISOString().split('T')[0];
  filterEstado: EstadoCita | null = null;
  filterVeterinarioId: number | null = null;
  selectedCompanyId: number | null   = null;
  filtersOpen                        = false;

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

  citaForm: FormGroup = this.fb.group({
    mascotaId:       [null, [Validators.required]],
    veterinarioId:   [null, [Validators.required]],
    motivoCita:      ['',   [Validators.required]],
    fechaHoraInicio: [null, [Validators.required]],
    notas:           ['']
  });

  ngOnInit() {
    if (this.isSuperAdmin()) {
      this.loadEmpresas();
    } else {
      this.loadCitas();
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
    this.loadCitas();
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

    this.loadingStore.show();
    this.citaService.listar(
      companyId,
      fechaStr,
      this.filterEstado    || undefined,
      this.filterVeterinarioId || undefined,
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

  loadVeterinarios() {
    this.empleadoService.listar(undefined, undefined, 0, 100).subscribe({
      next: (res) => {
        this.veterinarios.set(
          res.data.content
            .filter(e => e.tiposEmpleado.includes('VETERINARIO'))
            .map(e => ({ label: `${e.nombre} ${e.apellido}`, value: e.id }))
        );
      }
    });
  }

  loadClientes() {
    this.apoderadoService.listar(undefined, undefined, undefined, 0, 100).subscribe({
      next: (res) => {
        this.clientes.set(
          res.data.content.map(c => ({ label: `${c.nombre} ${c.apellido}`, value: c.id }))
        );
      }
    });
  }

  loadAllMascotas() {
    this.mascotaService.listar(undefined, undefined, undefined, 0, 500).subscribe({
      next: (res) => this.allMascotas.set(res.data.content)
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

  openNew() {
    this.citaForm.reset();
    this.filteredMascotas.set([]);
    this.displayModal.set(true);
  }

  saveCita() {
    if (this.citaForm.invalid) {
      this.citaForm.markAllAsTouched();
      return;
    }
    const formValue = this.citaForm.value;
    const request: CitaRequest = {
      ...formValue,
      fechaHoraInicio: (formValue.fechaHoraInicio as Date).toISOString()
    };
    this.loadingStore.show();
    this.citaService.crear(request).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Cita programada correctamente' });
        this.displayModal.set(false);
        this.loadCitas();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al programar la cita' });
        this.loadingStore.hide();
      }
    });
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
}
