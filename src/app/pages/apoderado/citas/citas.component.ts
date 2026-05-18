import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CalendarModule } from 'primeng/calendar';
import { MessageService } from 'primeng/api';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { AuthStore } from '../../../store/auth.store';
import { LoadingStore } from '../../../store/loading.store';

@Component({
  selector: 'app-apoderado-citas',
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
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);
  private loadTimeout: any = null;

  // Lists & Signals
  mascotas = signal<any[]>([]);
  citas = signal<any[]>([]);
  servicios = signal<any[]>([]);
  vets = signal<any[]>([]);
  availableSlots = signal<string[]>([]);
  
  // View Modes & Filters
  citasViewMode = signal<'list' | 'grid'>('list');
  selectedPetFilter = signal<number | null>(null);
  loadingSlots = signal<boolean>(false);
  today = new Date();

  // Modals & States
  displayCitaModal = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  isRescheduling = signal<boolean>(false);
  editingCitaId = signal<number | null>(null);

  citaForm: FormGroup = this.fb.group({
    mascotaId: [null, [Validators.required]],
    servicioId: [null, [Validators.required]],
    veterinarioId: [null, [Validators.required]],
    fechaCita: [null, [Validators.required]],
    horaCita: [null, [Validators.required]],
    motivoCita: ['', [Validators.required, Validators.minLength(5)]],
    notas: ['']
  });

  ngOnInit() {
    this.loadInitialData();
  }

  loadInitialData() {
    this.loadingStore.show();
    this.loadMascotas();
    this.loadCitas();
    this.loadPortalServices();
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
    this.apoderadoService.getPortalCitasFiltradas(filterId || undefined).subscribe({
      next: (res) => {
        this.citas.set(res.data);
        this.loadingStore.hide();
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar sus citas médicas.' });
        this.loadingStore.hide();
      }
    });
  }

  filterCitasByPet(petId: number | null) {
    this.selectedPetFilter.set(petId);
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

    const dateObj: Date = val.fechaCita;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const fechaStr = `${year}-${month}-${day}`;

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

  openNuevaCita() {
    this.isEditing.set(false);
    this.isRescheduling.set(false);
    this.editingCitaId.set(null);
    this.vets.set([]);
    this.availableSlots.set([]);
    this.citaForm.reset({
      mascotaId: this.mascotas().length > 0 ? this.mascotas()[0].id : null,
      servicioId: null,
      veterinarioId: null,
      fechaCita: null,
      horaCita: null,
      motivoCita: '',
      notas: ''
    });
    this.displayCitaModal.set(true);
  }

  canUpdateDetails(cita: any): boolean {
    if (!cita) return false;
    const editableStates = ['PENDIENTE', 'CONFIRMADA', 'PROGRAMADA', 'REPROGRAMADA'];
    return editableStates.includes(cita.estado);
  }

  canReschedule(cita: any): boolean {
    if (!cita) return false;
    const editableStates = ['PENDIENTE', 'CONFIRMADA', 'PROGRAMADA', 'REPROGRAMADA'];
    if (!editableStates.includes(cita.estado)) return false;
    
    const startTime = new Date(cita.fechaHoraInicio).getTime();
    const now = new Date().getTime();
    const oneHourInMs = 60 * 60 * 1000;
    return (startTime - now) >= oneHourInMs;
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
      fechaCita: new Date(cita.fechaHoraInicio),
      horaCita: new Date(cita.fechaHoraInicio).toTimeString().substring(0, 5),
      motivoCita: cita.motivoCita,
      notas: cita.notas || ''
    });

    this.displayCitaModal.set(true);
  }

  rescheduleCita(cita: any) {
    this.isEditing.set(false);
    this.isRescheduling.set(true);
    this.editingCitaId.set(cita.id);
    
    this.onServiceChange(cita.servicioId, true);
    this.availableSlots.set([]);

    this.citaForm.reset({
      mascotaId: cita.mascotaId,
      servicioId: cita.servicioId,
      veterinarioId: cita.veterinarioId,
      fechaCita: null,
      horaCita: null,
      motivoCita: cita.motivoCita,
      notas: cita.notas || ''
    });

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

    this.loadingStore.show();
    const formVal = this.citaForm.value;

    let isoString = '';
    if (!this.isEditing()) {
      const dateObj: Date = formVal.fechaCita;
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const timeStr = formVal.horaCita; 
      
      isoString = `${year}-${month}-${day}T${timeStr}:00`;
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
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }
}
