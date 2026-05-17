import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CalendarModule } from 'primeng/calendar';
import { MessageService } from 'primeng/api';
import { ApoderadoService } from '../../core/services/apoderado.service';
import { AuthStore } from '../../store/auth.store';
import { LoadingStore } from '../../store/loading.store';

@Component({
  selector: 'app-apoderado-portal',
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
    CalendarModule
  ],
  providers: [MessageService],
  templateUrl: './apoderado-portal.component.html',
  styleUrl: './apoderado-portal.component.scss'
})
export class ApoderadoPortalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly messageService = inject(MessageService);
  readonly authStore = inject(AuthStore);
  readonly loadingStore = inject(LoadingStore);

  // Portal Signals
  activeTab = signal<string>('mascotas');
  perfil = signal<any>(null);
  mascotas = signal<any[]>([]);
  citas = signal<any[]>([]);
  recetas = signal<any[]>([]);

  // Filtering & View Modes
  citasViewMode = signal<'list' | 'grid'>('list');
  selectedPetFilter = signal<number | null>(null);

  // Modals & Details
  selectedPetHistoria = signal<any>(null);
  displayHistoriaModal = signal<boolean>(false);
  displayCitaModal = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  isRescheduling = signal<boolean>(false);
  editingCitaId = signal<number | null>(null);

  // Booking Signals & Lists
  servicios = signal<any[]>([]);
  vets = signal<any[]>([]);
  availableSlots = signal<string[]>([]);
  loadingSlots = signal<boolean>(false);
  today = new Date();

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
    this.apoderadoService.getPortalPerfil().subscribe({
      next: (res) => {
        this.perfil.set(res.data);
        this.loadMascotas();
        this.loadCitas();
        this.loadRecetas();
        this.loadPortalServices();
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error de acceso', detail: 'No se pudo cargar el perfil del propietario.' });
        this.loadingStore.hide();
      }
    });
  }

  loadMascotas() {
    this.apoderadoService.getPortalMascotas().subscribe({
      next: (res) => this.mascotas.set(res.data),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener tus mascotas.' })
    });
  }

  loadCitas() {
    const filterId = this.selectedPetFilter();
    this.apoderadoService.getPortalCitasFiltradas(filterId || undefined).subscribe({
      next: (res) => {
        this.citas.set(res.data);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener tus citas.' });
        this.loadingStore.hide();
      }
    });
  }

  filterCitasByPet(petId: number | null) {
    this.selectedPetFilter.set(petId);
    this.loadCitas();
  }

  loadRecetas() {
    this.apoderadoService.getPortalRecetas().subscribe({
      next: (res) => this.recetas.set(res.data),
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener tus recetas médicas.' })
    });
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
      // Reset following fields in form
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

    // Load active matching professionals for selected service
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

    // Format localDate as YYYY-MM-DD
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
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo obtener la disponibilidad del profesional.' });
        this.loadingSlots.set(false);
      }
    });
  }

  selectTimeSlot(slot: string) {
    this.citaForm.patchValue({ horaCita: slot });
  }

  changeTab(tab: string) {
    this.activeTab.set(tab);
  }

  verHistoriaClinica(mascota: any) {
    this.loadingStore.show();
    this.apoderadoService.getPortalMascotaHistoria(mascota.id).subscribe({
      next: (res) => {
        this.selectedPetHistoria.set({
          mascota,
          historia: res.data
        });
        this.displayHistoriaModal.set(true);
        this.loadingStore.hide();
      },
      error: (err: any) => {
        this.messageService.add({ 
          severity: 'info', 
          summary: 'Historial Clínico', 
          detail: 'Esta mascota aún no cuenta con atenciones registradas.' 
        });
        this.loadingStore.hide();
      }
    });
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
    
    // Regla de 1 hora de anticipacion
    const startTime = new Date(cita.fechaHoraInicio).getTime();
    const now = new Date().getTime();
    const oneHourInMs = 60 * 60 * 1000;
    return (startTime - now) >= oneHourInMs;
  }

  editCitaDetails(cita: any) {
    this.isEditing.set(true);
    this.isRescheduling.set(false);
    this.editingCitaId.set(cita.id);
    
    // Pre-cargar los veterinarios disponibles para el servicio original sin reiniciar el formulario
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
    
    // Pre-cargar los veterinarios disponibles para el servicio original sin reiniciar el formulario
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
    return pet ? pet.nombreCompleto : 'Loading...';
  }

  getServiceName(id: any): string {
    const service = this.servicios().find(s => s.value === Number(id));
    return service ? service.label : 'Loading...';
  }

  saveCita() {
    if (this.citaForm.invalid) {
      this.citaForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Invalid Form', detail: 'Please fill in all required fields.' });
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
      const timeStr = formVal.horaCita; // e.g. "09:20"
      
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
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Appointment details updated successfully!' });
          this.displayCitaModal.set(false);
          this.loadCitas();
        },
        error: (err) => {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Update Error', 
            detail: err.error?.message || 'Could not update appointment details.' 
          });
          this.loadingStore.hide();
        }
      });
    } else if (this.isRescheduling()) {
      this.apoderadoService.reschedulePortalCita(this.editingCitaId()!, request).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Appointment rescheduled successfully!' });
          this.displayCitaModal.set(false);
          this.loadCitas();
        },
        error: (err) => {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Rescheduling Error', 
            detail: err.error?.message || 'Could not reschedule appointment.' 
          });
          this.loadingStore.hide();
        }
      });
    } else {
      this.apoderadoService.crearPortalCita(request).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Appointment scheduled successfully!' });
          this.displayCitaModal.set(false);
          this.loadCitas();
        },
        error: (err) => {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Scheduling Error', 
            detail: err.error?.message || 'The professional is not available at the selected time slot.' 
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

  getEspecieIcon(especie: string): string {
    switch (especie?.toUpperCase()) {
      case 'PERRO': return 'pi pi-tag text-sky-500';
      case 'GATO': return 'pi pi-tag text-emerald-500';
      default: return 'pi pi-tag text-indigo-500';
    }
  }
}
