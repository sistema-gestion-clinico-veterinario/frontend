import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputTextarea } from 'primeng/inputtextarea';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CitaService } from '../../../core/services/cita.service';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MascotaService } from '../../../core/services/mascota.service';
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
    TagModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './agenda.component.html'
})
export class AgendaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly citaService = inject(CitaService);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly mascotaService = inject(MascotaService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  citas = signal<CitaResponse[]>([]);
  totalRecords = signal<number>(0);
  displayModal = signal<boolean>(false);
  
  veterinarios = signal<any[]>([]);
  clientes = signal<any[]>([]);
  allMascotas = signal<MascotaResponse[]>([]);
  filteredMascotas = signal<any[]>([]);
  
  estados = Object.values(EstadoCita).map(e => ({ label: e, value: e }));

  citaForm: FormGroup = this.fb.group({
    mascotaId: [null, [Validators.required]],
    veterinarioId: [null, [Validators.required]],
    motivoCita: ['', [Validators.required]],
    fechaHoraInicio: [null, [Validators.required]],
    notas: ['']
  });

  filterFecha: Date = new Date();
  filterEstado: EstadoCita | null = null;
  filterVeterinarioId: number | null = null;

  ngOnInit() {
    this.loadCitas();
    this.loadVeterinarios();
    this.loadClientes();
    this.loadAllMascotas();
  }

  loadCitas(event: any = { first: 0, rows: 10 }) {
    const page = event.first / event.rows;
    const fechaStr = this.filterFecha ? this.filterFecha.toISOString().split('T')[0] : undefined;
    
    this.loadingStore.show();
    this.citaService.listar(
      undefined, 
      fechaStr, 
      this.filterEstado || undefined, 
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
        const vets = res.data.content
          .filter(e => e.tiposEmpleado.includes('VETERINARIO'))
          .map(e => ({ label: `${e.nombre} ${e.apellido}`, value: e.id }));
        this.veterinarios.set(vets);
      }
    });
  }

  loadClientes() {
    this.apoderadoService.listar(undefined, undefined, undefined, 0, 100).subscribe({
      next: (res) => {
        const list = res.data.content.map(c => ({ label: `${c.nombre} ${c.apellido}`, value: c.id }));
        this.clientes.set(list);
      }
    });
  }

  loadAllMascotas() {
    this.mascotaService.listar(undefined, undefined, undefined, 0, 500).subscribe({
      next: (res) => {
        this.allMascotas.set(res.data.content);
      }
    });
  }

  onClienteChange(clienteId: number) {
    const pets = this.allMascotas()
      .filter(m => m.apoderadoId === clienteId)
      .map(m => ({ label: m.nombreCompleto, value: m.id }));
    this.filteredMascotas.set(pets);
    this.citaForm.get('mascotaId')?.setValue(null);
  }

  openNew() {
    this.citaForm.reset();
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
      fechaHoraInicio: formValue.fechaHoraInicio.toISOString()
    };

    this.loadingStore.show();
    this.citaService.crear(request).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Cita programada correctamente' });
        this.displayModal.set(false);
        this.loadCitas();
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al programar cita' });
        this.loadingStore.hide();
      }
    });
  }

  iniciarCita(cita: CitaResponse) {
    this.loadingStore.show();
    this.citaService.iniciarAtencion(cita.id).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Atención iniciada' });
        this.loadingStore.hide();
        // Redirigir a la consulta (suponiendo que existe la ruta)
        this.router.navigate(['/historias-clinicas/consulta', res.data]);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al iniciar atención' });
        this.loadingStore.hide();
      }
    });
  }

  getEstadoSeverity(estado: EstadoCita): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (estado) {
      case EstadoCita.COMPLETADA: return 'success';
      case EstadoCita.PROGRAMADA: return 'info';
      case EstadoCita.EN_PROCESO: return 'warn';
      case EstadoCita.CANCELADA: return 'danger';
      case EstadoCita.NO_ASISTIO: return 'secondary';
      default: return 'info';
    }
  }
}
