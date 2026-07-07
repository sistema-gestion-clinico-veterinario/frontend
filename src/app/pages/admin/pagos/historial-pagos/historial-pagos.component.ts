import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { PagoService } from '../../../../core/services/pago.service';
import { PagoListResponse } from '../../../../models/response/pago-response';
import { AuthStore } from '../../../../store/auth.store';

@Component({
  selector: 'app-historial-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ToastModule, PaginatorModule],
  providers: [MessageService],
  templateUrl: './historial-pagos.component.html',
  styleUrl: './historial-pagos.component.scss'
})
export class HistorialPagosComponent implements OnInit {
  private readonly pagoService  = inject(PagoService);
  private readonly messageService = inject(MessageService);
  readonly authStore             = inject(AuthStore);
  pagos          = signal<PagoListResponse[]>([]);
  totalRecords   = signal<number>(0);
  currentPage    = signal<number>(0);
  pageSize       = signal<number>(10);

  // Panel derecho
  selectedPago   = signal<PagoListResponse | null>(null);
  showPanel      = signal<boolean>(false);

  // Filtro local por estado de pago
  filtroEstado   = signal<string>('');
  filtroMetodo   = signal<string>('');

  readonly pagosFiltrados = computed(() => {
    let lista = this.pagos();
    const estado = this.filtroEstado();
    const metodo = this.filtroMetodo();
    if (estado) lista = lista.filter(p => p.estado === estado);
    if (metodo) lista = lista.filter(p => p.metodoPago === metodo);
    return lista;
  });

  ngOnInit() {
    this.cargar();
  }

  get companyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId() ?? undefined;
  }

  cargar(event?: any) {
    if (event) {
      this.currentPage.set(event.first / event.rows);
      this.pageSize.set(event.rows);
    }
    this.pagoService.listarTodos(this.currentPage(), this.pageSize(), this.companyId).subscribe({
      next: (res) => {
        this.pagos.set(res.data?.content ?? []);
        this.totalRecords.set((res.data as any)?.page?.totalElements ?? res.data?.totalElements ?? 0);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el historial de pagos.' });
      }
    });
  }

  verDetalle(pago: PagoListResponse) {
    this.selectedPago.set(pago);
    this.showPanel.set(true);
  }

  cerrarPanel() {
    this.showPanel.set(false);
    this.selectedPago.set(null);
  }

  onFiltroChange() {
    this.currentPage.set(0);
    this.cargar();
  }

  avatarBadgeClass(estado: string | null, dark = false): string {
    if (dark) {
      switch (estado) {
        case 'PAID':             return 'bg-green-100 text-green-700';
        case 'PENDING_TRANSFER': return 'bg-blue-100 text-blue-700';
        case 'REJECTED':         return 'bg-red-100 text-red-600';
        case 'REFUNDED':         return 'bg-purple-100 text-purple-700';
        default:                 return 'bg-amber-100 text-amber-700';
      }
    }
    switch (estado) {
      case 'PAID':             return 'bg-green-50 text-green-700';
      case 'PENDING_TRANSFER': return 'bg-blue-50 text-blue-700';
      case 'REJECTED':         return 'bg-red-50 text-red-600';
      case 'REFUNDED':         return 'bg-purple-50 text-purple-700';
      default:                 return 'bg-amber-50 text-amber-700';
    }
  }

  estadoBadge(estado: string | null): string {
    switch (estado) {
      case 'PAID':             return 'bg-green-50 text-green-700 border border-green-200';
      case 'PENDING':          return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'PENDING_TRANSFER': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'REJECTED':         return 'bg-red-50 text-red-700 border border-red-200';
      case 'REFUNDED':         return 'bg-purple-50 text-purple-700 border border-purple-200';
      default:                 return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  }

  estadoLabel(estado: string | null): string {
    switch (estado) {
      case 'PAID':             return 'Pagado';
      case 'PENDING':          return 'Pendiente';
      case 'PENDING_TRANSFER': return 'Transf. Pendiente';
      case 'REJECTED':         return 'Rechazado';
      case 'REFUNDED':         return 'Reembolsado';
      default:                 return estado ?? '—';
    }
  }

  estadoCitaBadge(estado: string | null): string {
    switch (estado) {
      case 'COMPLETADA':  return 'bg-green-50 text-green-700 border border-green-200';
      case 'EN_ATENCION': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'CANCELADA':   return 'bg-red-50 text-red-700 border border-red-200';
      case 'PENDIENTE':
      case 'PROGRAMADA':  return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:            return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  }

  formatFecha(fecha: string | null): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatMonto(monto: number | null): string {
    if (monto == null) return '—';
    return `S/ ${Number(monto).toFixed(2)}`;
  }

  metodoPagoLabel(m: string | null): string {
    if (m === 'YAPE') return 'Yape';
    if (m === 'EFECTIVO') return 'Efectivo';
    return m ?? '—';
  }
}
