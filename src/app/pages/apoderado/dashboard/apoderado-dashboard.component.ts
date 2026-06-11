import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthStore } from '../../../store/auth.store';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { LoadingStore } from '../../../store/loading.store';
import { PagoService } from '../../../core/services/pago.service';
import { PagoListResponse } from '../../../models/response/pago-response';

@Component({
  selector: 'app-apoderado-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastModule],
  providers: [MessageService],
  templateUrl: './apoderado-dashboard.component.html'
})
export class ApoderadoDashboardComponent implements OnInit {
  private readonly authStore        = inject(AuthStore);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly loadingStore     = inject(LoadingStore);
  private readonly messageService   = inject(MessageService);
  private readonly pagoService      = inject(PagoService);

  readonly today = new Date();

  userName    = this.authStore.nombreCompleto() ?? '';
  companyName = this.authStore.companyName() ?? '';

  mascotas = signal<any[]>([]);
  citas    = signal<any[]>([]);
  pagos    = signal<PagoListResponse[]>([]);
  loadingPagos = signal(true);

  canViewMisPagos = computed(() => this.authStore.hasAccess('VISTA_MIS_PAGOS', 'leer'));

  totalPagos      = computed(() => this.pagos().length);
  pagosPagados    = computed(() => this.pagos().filter(p => p.estado === 'PAID' || p.estado === 'COMPLETADO').length);
  pagosPendientes = computed(() => this.pagos().filter(p => p.estado === 'PENDING' || p.estado === 'PENDING_TRANSFER').length);
  totalMonto      = computed(() => this.pagos().reduce((sum, p) => sum + (p.monto ?? 0), 0));

  totalMascotas   = computed(() => this.mascotas().length);
  mascotasActivas = computed(() => this.mascotas().filter(m => m.activo !== false).length);

  citasProximas = computed(() => {
    const now = new Date();
    return this.citas()
      .filter(c =>
        (c.estado === 'PROGRAMADA' || c.estado === 'REPROGRAMADA') &&
        new Date(c.fechaHoraInicio) >= now
      )
      .sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime())
      .slice(0, 8);
  });

  citasHoy = computed(() => {
    const hoy = this.today;
    return this.citas().filter(c => {
      if (!c.fechaHoraInicio) return false;
      const d = new Date(c.fechaHoraInicio);
      return d.getFullYear() === hoy.getFullYear() &&
             d.getMonth()    === hoy.getMonth()    &&
             d.getDate()     === hoy.getDate();
    });
  });

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loadingStore.show();

    this.apoderadoService.getPortalMascotas().subscribe({
      next: (res) => this.mascotas.set(res.data ?? []),
      error: () => {}
    });

    this.apoderadoService.getPortalCitas().subscribe({
      next: (res) => {
        this.citas.set(res.data?.content ?? res.data ?? []);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar tus citas.' });
        this.loadingStore.hide();
      }
    });

    this.loadingPagos.set(true);

    const fallbackTimer = setTimeout(() => {
      if (this.loadingPagos()) {
        this.loadingPagos.set(false);
      }
    }, 8000);

    this.pagoService.getMisPagos(0, 5).subscribe({
      next: (res) => {
        clearTimeout(fallbackTimer);
        this.pagos.set(res.data?.content ?? []);
        this.loadingPagos.set(false);
      },
      error: () => {
        clearTimeout(fallbackTimer);
        this.loadingPagos.set(false);
      }
    });
  }

  get userInitials(): string {
    return (this.userName ?? '')
      .split(' ').slice(0, 2)
      .map(n => n[0] ?? '')
      .join('')
      .toUpperCase();
  }

  get dayGreeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatFecha(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatHora(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const h = d.getHours();
    const m = d.getMinutes();
    return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
  }

  estadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'PROGRAMADA':   return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'REPROGRAMADA': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETADA':   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELADA':    return 'bg-red-50 text-red-600 border-red-200';
      case 'EN_PROCESO':   return 'bg-violet-50 text-violet-700 border-violet-200';
      default:             return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  estadoLabel(estado: string): string {
    const map: Record<string, string> = {
      PROGRAMADA:   'Programada',
      REPROGRAMADA: 'Reprogramada',
      COMPLETADA:   'Completada',
      CANCELADA:    'Cancelada',
      EN_PROCESO:   'En proceso'
    };
    return map[estado] ?? estado;
  }

  pagoEstadoBadge(estado: string): string {
    switch (estado) {
      case 'PAID':
      case 'COMPLETADO':     return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING':
      case 'PENDING_TRANSFER': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REJECTED':
      case 'CANCELLED':      return 'bg-red-50 text-red-600 border-red-200';
      default:               return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  pagoEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      PAID: 'Pagado',
      COMPLETADO: 'Completado',
      PENDING: 'Pendiente',
      PENDING_TRANSFER: 'Transf. Pendiente',
      REJECTED: 'Rechazado',
      CANCELLED: 'Anulado'
    };
    return map[estado] ?? estado;
  }

  formatMonto(monto: number | null | undefined): string {
    if (monto == null) return '—';
    return 'S/ ' + monto.toFixed(2);
  }

  formatFechaSimple(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  metodoPagoLabel(metodo: string | null | undefined): string {
    if (!metodo) return '—';
    const map: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      YAPE: 'Yape',
      PLIN: 'Plin',
      TARJETA: 'Tarjeta',
      TRANSFERENCIA: 'Transferencia'
    };
    return map[metodo] ?? metodo;
  }
}
