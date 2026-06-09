import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PagoService } from '../../../core/services/pago.service';
import { PagoPortalResponse } from '../../../models/response/pago-portal-response';

@Component({
  selector: 'app-mis-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, PaginatorModule, ToastModule],
  providers: [MessageService],
  templateUrl: './mis-pagos.component.html',
  styleUrl: './mis-pagos.component.scss'
})
export class MisPagosComponent implements OnInit {
  private readonly pagoService    = inject(PagoService);
  private readonly messageService = inject(MessageService);

  pagos        = signal<PagoPortalResponse[]>([]);
  isLoading    = signal<boolean>(true);
  totalRecords = signal<number>(0);
  page         = signal<number>(0);
  size         = signal<number>(10);

  selectedPago = signal<PagoPortalResponse | null>(null);
  showPanel    = signal<boolean>(false);

  filtroEstado = signal<string>('');

  totalPagado   = computed(() => this.pagos().filter(p => p.estadoPago === 'PAID').length);
  totalPendiente = computed(() => this.pagos().filter(p => p.estadoPago === 'PENDING').length);
  totalRechazado = computed(() => this.pagos().filter(p => p.estadoPago === 'REJECTED').length);

  ngOnInit() {
    this.cargar();
  }

  cargar(event?: any) {
    if (event) {
      this.page.set(event.first / event.rows);
      this.size.set(event.rows);
    } else {
      this.isLoading.set(true);
    }
    this.pagoService.getPaymentHistory(this.page(), this.size()).subscribe({
      next: (res) => {
        this.pagos.set(res.data?.content ?? []);
        this.totalRecords.set((res.data as any)?.page?.totalElements ?? res.data?.totalElements ?? 0);
        this.isLoading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el historial de pagos.' });
        this.isLoading.set(false);
      }
    });
  }

  get pagosFiltrados(): PagoPortalResponse[] {
    const estado = this.filtroEstado();
    if (!estado) return this.pagos();
    return this.pagos().filter(p => p.estadoPago === estado);
  }

  verDetalle(pago: PagoPortalResponse) {
    this.selectedPago.set(pago);
    this.showPanel.set(true);
  }

  cerrarPanel() {
    this.showPanel.set(false);
    this.selectedPago.set(null);
  }

  onPageChange(event: any) {
    this.page.set(event.page ?? 0);
    this.size.set(event.rows ?? 10);
    this.cargar(event);
  }

  estadoBadge(estado: string | null): string {
    switch (estado) {
      case 'PAID':             return 'bg-green-50 text-green-700 border border-green-200';
      case 'PENDING':          return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'PENDING_TRANSFER': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'REJECTED':         return 'bg-red-50 text-red-700 border border-red-200';
      default:                 return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  }

  estadoLabel(estado: string | null): string {
    switch (estado) {
      case 'PAID':             return 'Pagado';
      case 'PENDING':          return 'Pendiente';
      case 'PENDING_TRANSFER': return 'Transf. Pendiente';
      case 'REJECTED':         return 'Rechazado';
      default:                 return estado ?? '—';
    }
  }

  estadoCitaBadge(estado: string | null): string {
    switch (estado) {
      case 'COMPLETADA':  return 'bg-green-50 text-green-700 border border-green-200';
      case 'EN_ATENCION': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'CANCELADA':   return 'bg-red-50 text-red-700 border border-red-200';
      default:            return 'bg-blue-50 text-blue-700 border border-blue-200';
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
