import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, skip } from 'rxjs/operators';
import { AuthStore } from '../../store/auth.store';
import { DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';
import { Role } from '../../core/enums/role.enum';
import { LoadingStore } from '../../store/loading.store';
import { ChangePasswordModalComponent } from '../../layouts/main-layout/change-password-modal/change-password-modal.component';
import { PagoListResponse } from '../../models/response/pago-response';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DropdownModule, SkeletonModule, FormsModule, RouterModule, ChangePasswordModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private authStore      = inject(AuthStore);
  private dashboardService = inject(DashboardService);
  private loadingStore   = inject(LoadingStore);
  private router         = inject(Router);
  private destroyRef       = inject(DestroyRef);

  userName        = this.authStore.nombreCompleto() ?? '';
  roles           = this.authStore.roles() ?? [];
  isSuperAdmin    = this.roles.includes(Role.SUPER_ADMIN);
  isAdmin         = this.roles.includes(Role.ADMIN);
  isVeterinario   = this.roles.includes(Role.VETERINARIO);
  isRecepcionista = this.roles.includes(Role.RECEPCIONISTA);

  readonly today       = new Date();
  get dashboardScopeLabel(): string {
    if (this.isGlobalSuperAdminMode) return 'Todas las empresas';
    return this.authStore.selectedEnterprise()?.name ?? this.authStore.companyName() ?? '';
  }

  get companyName(): string {
    return this.dashboardScopeLabel;
  }

  get scopeDescription(): string {
    return this.isGlobalSuperAdminMode ? 'del sistema' : 'de la sede';
  }

  get isGlobalSuperAdminMode(): boolean {
    return this.isSuperAdmin && !this.authStore.selectedEnterprise()?.establishmentId;
  }

  stats              = signal<DashboardStats | null>(null);
  companies          = signal<any[]>([]);
  selectedCompanyId: number | null = null;
  recentLogs         = signal<any[]>([]);
  showPasswordModal  = signal(
    !this.authStore.passwordChanged() &&
    sessionStorage.getItem('pw_modal_dismissed') !== '1'
  );

  employeesList       = signal<any[]>([]);
  todayAppointmentsList = signal<any[]>([]);
  petsList            = signal<any[]>([]);
  rolesList           = signal<any[]>([]);
  apoderadosList      = signal<any[]>([]);
  schedulesReport     = signal<any[]>([]);
  allAppointments     = signal<any[]>([]);
  chartPeriod         = signal<'day' | 'week' | 'month'>('day');
  pagos               = signal<PagoListResponse[]>([]);
  loadingPagos        = signal(false);
  cargando            = signal(true);

  // ─── Reacciona solo cuando selectedEnterprise cambia realmente ───
  constructor() {
    toObservable(this.authStore.selectedEnterprise)
      .pipe(
        distinctUntilChanged((a, b) =>
          a?.establishmentId === b?.establishmentId
        ),
        skip(1), // el primer valor lo maneja ngOnInit
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(enterprise => {
        const compId = this.authStore.companyId();
        const targetId = enterprise?.establishmentId ?? compId ?? undefined;
        this.loadAllDashboardData(targetId);
      });
  }

  ngOnInit(): void {
    // Carga inicial una sola vez
    const enterprise   = this.authStore.selectedEnterprise();
    const compId       = this.authStore.companyId();
    const targetId     = enterprise?.establishmentId ?? compId ?? undefined;
    this.loadAllDashboardData(targetId);
  }

  // ─── Computed ────────────────────────────────────────────────────

  chartData = computed(() => {
    const period       = this.chartPeriod();
    const currentStats = this.stats();

    const getDatesOfWeek = () => {
      const dates: string[] = [];
      const now        = new Date();
      const dayOfWeek  = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday     = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const dayNames   = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dayNum   = d.getDate();
        const monthNum = d.getMonth() + 1;
        const monthStr = monthNum < 10 ? '0' + monthNum : String(monthNum);
        dates.push(`${dayNames[i]} ${dayNum}/${monthStr}`);
      }
      return dates;
    };

    if (period === 'day') {
      const vals   = currentStats?.citasPorDia ?? [0, 0, 0, 0, 0, 0, 0];
      const maxVal = Math.max(...vals, 1);
      return {
        labels: getDatesOfWeek(), values: vals, max: maxVal, color: '#0066AA',
        yAxisLabels: [maxVal, Math.round(maxVal * 0.67), Math.round(maxVal * 0.33), 0]
      };
    } else if (period === 'week') {
      const vals   = currentStats?.citasPorSemana ?? [0, 0, 0, 0];
      const maxVal = Math.max(...vals, 1);
      return {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'], values: vals, max: maxVal, color: '#10B981',
        yAxisLabels: [maxVal, Math.round(maxVal * 0.67), Math.round(maxVal * 0.33), 0]
      };
    } else {
      const vals   = currentStats?.citasPorMes ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const maxVal = Math.max(...vals, 1);
      return {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
        values: vals, max: maxVal, color: '#8B5CF6',
        yAxisLabels: [maxVal, Math.round(maxVal * 0.67), Math.round(maxVal * 0.33), 0]
      };
    }
  });

  employeeAvailability = computed(() => {
    const report       = this.schedulesReport();
    const appointments = this.todayAppointmentsList();
    const todayStr     = this.todayInLima();
    const now          = new Date();
    const currentHourStr = now.toLocaleTimeString('es-PE', { hour12: false }).substring(0, 5);

    return report.map((emp: any) => {
      const todayShift = emp.horarios?.find((h: any) => {
        if (!h.fecha || !h.activo) return false;
        return h.fecha.startsWith(todayStr) || h.fecha === todayStr;
      });

      if (!todayShift) {
        return {
          id: emp.empleadoId,
          nombre: emp.nombreCompleto || `${emp.nombre} ${emp.apellido}`,
          cargo: emp.cargo || 'Personal',
          status: 'OFFLINE', statusLabel: 'No Labora Hoy',
          shiftLabel: 'N/A', badgeClass: 'bg-slate-50 text-slate-400 border-slate-100'
        };
      }

      const shiftStart    = todayShift.horaInicio.substring(0, 5);
      const shiftEnd      = todayShift.horaFin.substring(0, 5);
      const isInsideShift = currentHourStr >= shiftStart && currentHourStr <= shiftEnd;

      const isBusyNow = appointments.some((cita: any) => {
        if (cita.veterinarioId !== emp.empleadoId) return false;
        if (!['EN_PROCESO', 'PROGRAMADA', 'REPROGRAMADA'].includes(cita.estado)) return false;
        const appStart = cita.fechaHoraInicio.split('T')[1]?.substring(0, 5);
        const appEnd   = cita.fechaHoraFin.split('T')[1]?.substring(0, 5);
        return currentHourStr >= appStart && currentHourStr <= appEnd;
      });

      let status = 'AVAILABLE', statusLabel = 'Disponible';
      let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';

      if (!isInsideShift) {
        status = 'OFFLINE'; statusLabel = 'Fuera de Turno';
        badgeClass = 'bg-slate-50 text-slate-400 border-slate-100';
      } else if (isBusyNow) {
        status = 'BUSY'; statusLabel = 'Ocupado';
        badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
      }

      return {
        id: emp.empleadoId,
        nombre: emp.nombreCompleto || `${emp.nombre} ${emp.apellido}`,
        cargo: emp.cargo || 'Personal',
        status, statusLabel,
        shiftLabel: `${shiftStart} - ${shiftEnd}`,
        badgeClass
      };
    });
  });

  serviceBreakdown = computed(() => {
    const list = this.allAppointments();
    if (list.length === 0) return [];

    const counts: Record<string, number> = {};
    let total = 0;
    list.forEach((cita: any) => {
      const sName = cita.servicioNombre || 'Consulta General';
      counts[sName] = (counts[sName] || 0) + 1;
      total++;
    });

    const colors       = ['#0066AA', '#9333EA', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
    const bgClasses    = ['bg-[#0066AA]/10','bg-purple-500/10','bg-pink-500/10','bg-amber-500/10','bg-emerald-500/10','bg-blue-500/10'];
    const borderClasses= ['border-[#0066AA]/20','border-purple-500/20','border-pink-500/20','border-amber-500/20','border-emerald-500/20','border-blue-500/20'];

    return Object.keys(counts)
      .map((name, index) => {
        const count  = counts[name];
        const pct    = Math.round((count / total) * 100);
        const colIdx = index % colors.length;
        return { name, count, percentage: pct, color: colors[colIdx], bg: bgClasses[colIdx], border: borderClasses[colIdx] };
      })
      .sort((a, b) => b.count - a.count);
  });

  // ─── Getters ─────────────────────────────────────────────────────

  get userInitials(): string {
    return (this.userName ?? '')
      .split(' ').slice(0, 2)
      .map(n => n[0] ?? '').join('').toUpperCase();
  }

  get dayGreeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get rolePrincipal(): string {
    if (this.isSuperAdmin)    return 'Super Administrador';
    if (this.isAdmin)         return 'Administrador';
    if (this.isVeterinario)   return 'Veterinario';
    if (this.isRecepcionista) return 'Recepcionista';
    return this.roles[0]?.replace('ROLE_', '') ?? 'Usuario';
  }

  get roleBadgeClass(): string {
    if (this.isSuperAdmin)    return 'bg-violet-50 text-violet-700 border border-violet-100';
    if (this.isAdmin)         return 'bg-blue-50 text-[#0066AA] border border-blue-100';
    if (this.isVeterinario)   return 'bg-teal-50 text-teal-700 border border-teal-100';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }

  get quickActions(): { label: string; icon: string; route: string }[] {
    return [];
  }

  canView(vista: string): boolean {
    return this.authStore.hasAccess(vista, 'leer');
  }

  canViewCitas(): boolean {
    return this.canView('VISTA_CITAS_AGENDA');
  }

  canViewClientes(): boolean {
    return this.canView('VISTA_CLIENTES');
  }

  canViewMascotas(): boolean {
    return this.canView('VISTA_MASCOTAS');
  }

  canViewEmpleados(): boolean {
    return this.canView('VISTA_EMPLEADOS');
  }

  canViewHorarios(): boolean {
    return this.canView('VISTA_HORARIOS');
  }

  canViewRoles(): boolean {
    return this.canView('VISTA_ROLES');
  }

  canViewAuditoria(): boolean {
    return this.canView('VISTA_AUDITORIA_ADMIN');
  }

  canViewPayments(): boolean {
    return this.canView('VISTA_PAGOS');
  }

  pagoEstadoBadge(estado: string): string {
    switch (estado) {
      case 'PAID':
      case 'COMPLETADO':     return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING':        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PENDING_TRANSFER': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'REJECTED':
      case 'CANCELLED':      return 'bg-red-50 text-red-600 border-red-200';
      case 'REFUNDED':       return 'bg-purple-50 text-purple-700 border-purple-200';
      default:               return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  pagoEstadoDot(estado: string): string {
    switch (estado) {
      case 'PAID':
      case 'COMPLETADO':       return 'bg-emerald-500';
      case 'PENDING_TRANSFER': return 'bg-blue-500';
      case 'REJECTED':
      case 'CANCELLED':        return 'bg-red-500';
      case 'REFUNDED':         return 'bg-purple-500';
      default:                 return 'bg-amber-500';
    }
  }

  pagoEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      PAID: 'Pagado',
      COMPLETADO: 'Completado',
      PENDING: 'Pendiente',
      PENDING_TRANSFER: 'Transf. Pendiente',
      REJECTED: 'Rechazado',
      CANCELLED: 'Anulado',
      REFUNDED: 'Reembolsado'
    };
    return map[estado] ?? estado;
  }

  formatFechaSimple(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ─── Métodos de carga ────────────────────────────────────────────

  loadAllDashboardData(companyId?: number) {
    this.cargando.set(true);
    this.loadingStore.show();
    this.loadingPagos.set(true);
    this.dashboardService.getOverview(companyId).subscribe({
      next: ({ data }) => {
        this.stats.set(data.stats);
        this.recentLogs.set(this.canViewAuditoria() ? data.recentLogs ?? [] : []);
        this.employeesList.set(this.canViewEmpleados() ? data.employees ?? [] : []);
        const appointments = this.canViewCitas() ? data.todayAppointments ?? [] : [];
        this.todayAppointmentsList.set(appointments);
        this.allAppointments.set(appointments);
        this.petsList.set(this.canViewMascotas() ? data.pets ?? [] : []);
        this.rolesList.set(this.canViewRoles() ? data.roles ?? [] : []);
        this.apoderadosList.set(this.canViewClientes() ? data.guardians ?? [] : []);
        this.schedulesReport.set(this.canViewHorarios() ? data.schedules ?? [] : []);
        this.pagos.set(this.canViewPayments() ? data.payments ?? [] : []);
        this.companies.set((this.isSuperAdmin || this.canView('VISTA_COMPANY')) ? data.companies ?? [] : []);
        this.loadingPagos.set(false);
        this.cargando.set(false);
        this.loadingStore.hide();
      },
      error: () => {
        this.clearCompanyScopedLists();
        this.recentLogs.set([]);
        this.companies.set([]);
        this.loadingPagos.set(false);
        this.cargando.set(false);
        this.loadingStore.hide();
      }
    });
  }

  private clearCompanyScopedLists() {
    this.employeesList.set([]);
    this.todayAppointmentsList.set([]);
    this.petsList.set([]);
    this.rolesList.set([]);
    this.apoderadosList.set([]);
    this.schedulesReport.set([]);
    this.allAppointments.set([]);
    this.pagos.set([]);
    this.loadingPagos.set(false);
  }

  private todayInLima(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  // ─── Helpers UI ──────────────────────────────────────────────────

  formatDate(d: Date): string {
    return d.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const h = d.getHours();
      const m = d.getMinutes();
      return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
    } catch { return ''; }
  }

  formatActionName(action: string): string {
    if (!action) return 'ACCIÓN DESCONOCIDA';
    return action.replace(/_/g, ' ');
  }

  getActionStyle(action: string): { icon: string; bg: string; text: string; dot: string } {
    if (!action) return { icon: 'pi-info-circle', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };
    if (action.includes('CREAR') || action.includes('REGISTRAR') || action.includes('ACTIVAR'))
      return { icon: 'pi-plus-circle', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' };
    if (action.includes('ACTUALIZAR') || action.includes('REPROGRAMAR') || action.includes('CLONAR') || action.includes('ASIGNAR'))
      return { icon: 'pi-pencil', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' };
    if (action.includes('ELIMINAR') || action.includes('DESACTIVAR') || action.includes('CANCELAR') || action.includes('SUSPENSION'))
      return { icon: 'pi-trash', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' };
    if (action.includes('CONSULTA'))
      return { icon: 'pi-search', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' };
    return { icon: 'pi-bolt', bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400' };
  }

  permissionLabel(perm: string): string {
    const map: Record<string, string> = {
      EMPLOYEE_READ: 'Ver Personal',        EMPLOYEE_MANAGE: 'Gestionar Personal',
      CLIENT_READ: 'Ver Clientes',          CLIENT_MANAGE: 'Gestionar Clientes',
      APPOINTMENT_READ: 'Ver Citas',        APPOINTMENT_MANAGE: 'Gestionar Citas',
      CLINICAL_RECORD_READ: 'Ver HC',       CLINICAL_RECORD_MANAGE: 'Gestionar HC',
      COMPANY_READ: 'Ver Empresa',          COMPANY_MANAGE: 'Gestionar Empresa',
      ROLE_READ: 'Ver Roles',               ROLE_MANAGE: 'Gestionar Roles',
      SERVICE_READ: 'Ver Servicios',        SERVICE_MANAGE: 'Gestionar Servicios',
      PAYMENT_READ: 'Ver Pagos',            PAYMENT_MANAGE: 'Gestionar Pagos',
    };
    return map[perm] ?? perm.replace(/_/g, ' ').toLowerCase();
  }

  dismissPasswordModal() {
    sessionStorage.setItem('pw_modal_dismissed', '1');
    this.showPasswordModal.set(false);
  }

  logout() {
    this.authStore.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
