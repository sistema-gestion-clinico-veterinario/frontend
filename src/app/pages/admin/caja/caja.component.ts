import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { CajaService } from '../../../core/services/caja.service';
import { AuthStore } from '../../../store/auth.store';
import { MovimientoCajaResponse, ResumenCajaResponse } from '../../../models/response/movimiento-caja-response';

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule, PaginatorModule],
  providers: [MessageService],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss'
})
export class CajaComponent implements OnInit {
  private readonly cajaService   = inject(CajaService);
  private readonly messageService = inject(MessageService);
  readonly authStore             = inject(AuthStore);

  movimientos  = signal<MovimientoCajaResponse[]>([]);
  resumen      = signal<ResumenCajaResponse | null>(null);
  loading      = signal(false);
  totalRecords = signal(0);
  currentPage  = signal(0);
  pageSize     = signal(20);

  filtroDesde = '';
  filtroHasta = '';

  showEgresoModal = signal(false);
  egresoForm = { monto: null as number | null, descripcion: '', concepto: 'GASTO_OPERATIVO' as 'GASTO_OPERATIVO' | 'OTRO' };
  savingEgreso = signal(false);

  get companyId(): number {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId() ?? 0;
  }

  ngOnInit() { this.cargar(); }

  cargar(event?: any) {
    if (event) {
      this.currentPage.set(event.first / event.rows);
      this.pageSize.set(event.rows);
    }
    if (!this.companyId) return;
    this.loading.set(true);

    this.cajaService.resumen(this.companyId, this.filtroDesde || undefined, this.filtroHasta || undefined)
      .subscribe({ next: r => this.resumen.set(r.data), error: () => {} });

    this.cajaService.listar(this.companyId, this.filtroDesde || undefined, this.filtroHasta || undefined, this.currentPage(), this.pageSize())
      .subscribe({
        next: r => {
          this.movimientos.set(r.data?.content ?? []);
          this.totalRecords.set((r.data as any)?.page?.totalElements ?? r.data?.totalElements ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la caja.' });
          this.loading.set(false);
        }
      });
  }

  aplicarFiltros() { this.currentPage.set(0); this.cargar(); }

  limpiarFiltros() {
    this.filtroDesde = '';
    this.filtroHasta = '';
    this.currentPage.set(0);
    this.cargar();
  }

  abrirEgreso() {
    this.egresoForm = { monto: null, descripcion: '', concepto: 'GASTO_OPERATIVO' };
    this.showEgresoModal.set(true);
  }

  guardarEgreso() {
    if (!this.egresoForm.monto || !this.egresoForm.descripcion.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Ingresa monto y descripción.' });
      return;
    }
    this.savingEgreso.set(true);
    this.cajaService.registrarEgreso({
      monto: this.egresoForm.monto,
      descripcion: this.egresoForm.descripcion.trim(),
      companyId: this.companyId,
      concepto: this.egresoForm.concepto
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Egreso registrado' });
        this.showEgresoModal.set(false);
        this.savingEgreso.set(false);
        this.cargar();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo registrar.' });
        this.savingEgreso.set(false);
      }
    });
  }

  tipoBadge(tipo: string): string {
    if (tipo === 'INGRESO')    return 'bg-green-50 text-green-700 border border-green-200';
    if (tipo === 'EGRESO')     return 'bg-red-50 text-red-700 border border-red-200';
    if (tipo === 'DEVOLUCION') return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-slate-100 text-slate-600';
  }

  tipoLabel(tipo: string): string {
    if (tipo === 'INGRESO')    return 'Ingreso';
    if (tipo === 'EGRESO')     return 'Egreso';
    if (tipo === 'DEVOLUCION') return 'Devolución';
    return tipo;
  }

  conceptoLabel(c: string): string {
    const map: Record<string, string> = {
      PAGO_CITA: 'Pago de cita',
      CANCELACION_DEVOLUCION: 'Dev. cancelación',
      GASTO_OPERATIVO: 'Gasto operativo',
      OTRO: 'Otro'
    };
    return map[c] ?? c;
  }

  formatFecha(f: string): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatMonto(m: number | null): string {
    return m != null ? `S/ ${Number(m).toFixed(2)}` : '—';
  }
}
