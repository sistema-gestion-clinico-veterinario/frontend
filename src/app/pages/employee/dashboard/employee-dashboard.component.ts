import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthStore } from '../../../store/auth.store';
import { CitaService } from '../../../core/services/cita.service';
import { ProfileService } from '../../../core/services/profile.service';
import { LoadingStore } from '../../../store/loading.store';
import { Role } from '../../../core/enums/role.enum';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastModule],
  providers: [MessageService],
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.scss']
})
export class EmployeeDashboardComponent implements OnInit {
  private authStore = inject(AuthStore);
  private citaService = inject(CitaService);
  private profileService = inject(ProfileService);
  private loadingStore = inject(LoadingStore);
  private router = inject(Router);
  private messageService = inject(MessageService);

  userName = this.authStore.nombreCompleto() ?? '';
  roles = this.authStore.roles() ?? [];
  companyName = this.authStore.companyName() ?? '';
  empleadoId = this.authStore.empleadoId();

  readonly today = new Date();

  // Signals for holding loaded data
  todayAppointments = signal<any[]>([]);
  horariosList = signal<any[]>([]);

  ngOnInit() {
    this.loadDashboardData();
  }

  get userInitials(): string {
    return (this.userName ?? '')
      .split(' ')
      .slice(0, 2)
      .map(n => n[0] ?? '')
      .join('')
      .toUpperCase();
  }

  get dayGreeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get rolePrincipal(): string {
    if (this.roles.includes(Role.SUPER_ADMIN)) return 'Super Administrador';
    if (this.roles.includes(Role.ADMIN)) return 'Administrador';
    if (this.roles.includes(Role.VETERINARIO)) return 'Veterinario';
    if (this.roles.includes(Role.RECEPCIONISTA)) return 'Recepcionista';
    return this.roles[0]?.replace('ROLE_', '') ?? 'Empleado';
  }

  get roleBadgeClass(): string {
    if (this.roles.includes(Role.VETERINARIO)) return 'bg-teal-50 text-teal-700 border border-teal-100';
    if (this.roles.includes(Role.RECEPCIONISTA)) return 'bg-sky-50 text-sky-700 border border-sky-100';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }

  // Today's shift computed property
  todayShiftLabel = computed(() => {
    const schedules = this.horariosList();
    if (!schedules || schedules.length === 0) return 'No Asignado';

    const todayStr = this.today.toISOString().split('T')[0];
    const todaySchedule = schedules.find(h => {
      if (!h.fecha || !h.activo) return false;
      return h.fecha.startsWith(todayStr) || h.fecha === todayStr;
    });

    if (!todaySchedule) return 'Día Libre / No Labora';
    return `${todaySchedule.horaInicio.substring(0, 5)} - ${todaySchedule.horaFin.substring(0, 5)}`;
  });

  // KPIs computed properties
  totalCitasCount = computed(() => this.todayAppointments().length);

  completedCitasCount = computed(() => 
    this.todayAppointments().filter(c => c.estado === 'ATENDIDA').length
  );

  pendingCitasCount = computed(() => 
    this.todayAppointments().filter(c => 
      c.estado === 'PENDIENTE' || c.estado === 'PROGRAMADA' || c.estado === 'REPROGRAMADA'
    ).length
  );

  inProgressCitasCount = computed(() => 
    this.todayAppointments().filter(c => c.estado === 'EN_PROCESO').length
  );

  loadDashboardData() {
    this.loadingStore.show();

    // 1. Fetch employee schedule/profile information
    this.profileService.getProfile().subscribe({
      next: (res) => {
        if (res.data && res.data.horarios) {
          this.horariosList.set(res.data.horarios);
        }
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el horario de turnos.' });
      }
    });

    // 2. Fetch today's appointments assigned to this employee
    if (this.empleadoId) {
      this.citaService.listar(undefined, undefined, undefined, this.empleadoId, 0, 100).subscribe({
        next: (res) => {
          const content = res.data?.content ?? [];
          const todayYear = this.today.getFullYear();
          const todayMonth = this.today.getMonth();
          const todayDate = this.today.getDate();

          // Timezone-safe local date filter
          const filtered = content.filter((cita: any) => {
            if (!cita.fechaHoraInicio) return false;
            const citaDate = new Date(cita.fechaHoraInicio);
            return citaDate.getFullYear() === todayYear &&
                   citaDate.getMonth() === todayMonth &&
                   citaDate.getDate() === todayDate;
          });

          // Sort chronologically by start hour
          filtered.sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime());

          this.todayAppointments.set(filtered);
          this.loadingStore.hide();
        },
        error: () => {
          this.todayAppointments.set([]);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron recuperar las citas de hoy.' });
          this.loadingStore.hide();
        }
      });
    } else {
      this.loadingStore.hide();
    }
  }

  // Appointment Actions

  /** true si la cita puede iniciarse (dentro de la hora previa al horario) */
  canIniciar(cita: any): boolean {
    if (!cita?.fechaHoraInicio) return false;
    const ahora = Date.now();
    const inicio = new Date(cita.fechaHoraInicio).getTime();
    const minutosRestantes = (inicio - ahora) / 60000;
    // Permite iniciar si faltan ≤ 60 min (o ya pasó la hora de inicio)
    return minutosRestantes <= 60;
  }

  /** Texto descriptivo del tiempo restante para poder iniciar */
  tiempoParaIniciar(cita: any): string {
    if (!cita?.fechaHoraInicio) return '';
    const ahora = Date.now();
    const inicio = new Date(cita.fechaHoraInicio).getTime();
    const mins = Math.ceil((inicio - ahora) / 60000);
    if (mins <= 60) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `Disponible en ${h}h ${m}min` : `Disponible en ${m} min`;
  }

  iniciarAtencion(cita: any) {
    if (!this.canIniciar(cita)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Muy pronto',
        detail: `Solo puedes iniciar la atención dentro de la hora previa a la cita. ${this.tiempoParaIniciar(cita)}`
      });
      return;
    }
    this.loadingStore.show();
    this.citaService.iniciarAtencion(cita.id).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Atención iniciada con éxito.' });
        this.loadingStore.hide();
        this.router.navigate(['/historias-clinicas/consulta', res.data]);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al iniciar la atención.' });
        this.loadingStore.hide();
      }
    });
  }

  verHistorialClinico(cita: any) {
    this.router.navigate(['/historias-clinicas/mascota', cita.mascotaId]);
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const h = d.getHours();
      const m = d.getMinutes();
      return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
    } catch {
      return '';
    }
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // Quick Action Card Links
  get quickActions(): { label: string; icon: string; route: string; colorClass: string; permission?: string }[] {
    const list = [
      {
        label: 'Mi Horario',
        icon: 'pi pi-clock text-xl',
        route: '/mi-horario',
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50'
      },
      {
        label: 'Historias Clínicas',
        icon: 'pi pi-book text-xl',
        route: '/historias-clinicas',
        colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50',
        permission: 'CLINICAL_RECORD_READ'
      },
      {
        label: 'Mascotas',
        icon: 'pi pi-heart-fill text-xl',
        route: '/mascotas',
        colorClass: 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100/50',
        permission: 'PET_READ'
      },
      {
        label: 'Agenda de Citas',
        icon: 'pi pi-calendar text-xl',
        route: '/citas/agenda',
        colorClass: 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100/50',
        permission: 'CITA_READ'
      }
    ];

    return list.filter(act => !act.permission || this.authStore.hasAccess(act.permission, 'leer'));
  }
}
