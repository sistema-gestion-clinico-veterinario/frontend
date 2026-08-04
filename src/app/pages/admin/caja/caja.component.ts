import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { CajaService } from '../../../core/services/caja.service';
import { AuthStore } from '../../../store/auth.store';
import { MovimientoCajaResponse, ResumenCajaResponse } from '../../../models/response/movimiento-caja-response';
import { hasMeaningfulText, isDateRangeValid } from '../../../core/utils/input-validation.util';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { PagoService } from '../../../core/services/pago.service';
import { CuentaCitaResponse, DetalleCuentaRequest, DetalleCuentaResponse, TipoDetalleCuenta } from '../../../models/response/cuenta-cita-response';
import { MetodoPago } from '../../../models/request/pago-request';

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
  private readonly pagoService    = inject(PagoService);
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

  cuentasPendientes = signal<CuentaCitaResponse[]>([]);
  pendingLoading = signal(false);
  pendingTotal = signal(0);
  pendingPage = signal(0);
  posSearch = signal('');
  historialExpandido = signal(false);
  cuentasPos = computed(() => {
    const term = normalizeText(this.posSearch()).toLocaleLowerCase('es-PE');
    return this.cuentasPendientes().filter(cuenta => {
      const text = `${cuenta.citaId} ${cuenta.mascotaNombre} ${cuenta.apoderadoNombre} ${cuenta.servicioNombre}`.toLocaleLowerCase('es-PE');
      return !term || text.includes(term);
    });
  });
  movimientosVisibles = computed(() => this.historialExpandido() ? this.movimientos() : this.movimientos().slice(0, 5));
  cuentaSeleccionada = signal<CuentaCitaResponse | null>(null);
  savingDetalle = signal(false);
  savingPago = signal(false);
  nuevoDetalle: DetalleCuentaRequest = {
    tipo: 'MEDICAMENTO', descripcion: '', cantidad: 1, precioUnitario: 0
  };
  pagoForm: {
    metodoPago: MetodoPago;
    monto: number;
    montoRecibido: number | null;
    yapePhoneNumber: string;
    yapeOtp: string;
    payerEmail: string;
  } = {
    metodoPago: 'EFECTIVO', monto: 0, montoRecibido: null,
    yapePhoneNumber: '', yapeOtp: '', payerEmail: ''
  };

  get companyId(): number {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId() ?? 0;
  }

  ngOnInit() {
    this.cargar();
    this.cargarPendientes();
  }

  cargarPendientes(page = this.pendingPage()) {
    if (!this.companyId) return;
    this.pendingLoading.set(true);
    this.cajaService.listarPendientes(this.companyId, page, this.pageSize()).subscribe({
      next: r => {
        this.cuentasPendientes.set(r.data?.content ?? []);
        this.pendingTotal.set((r.data as any)?.page?.totalElements ?? r.data?.totalElements ?? 0);
        this.pendingPage.set(page);
        this.pendingLoading.set(false);
      },
      error: () => {
        this.pendingLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las cuentas pendientes.' });
      }
    });
  }

  abrirCuenta(cuenta: CuentaCitaResponse) {
    this.cajaService.obtenerCuenta(cuenta.citaId).subscribe({
      next: r => {
        this.cuentaSeleccionada.set(r.data);
        this.prepararPago(r.data);
        this.nuevoDetalle = { tipo: 'MEDICAMENTO', descripcion: '', cantidad: 1, precioUnitario: 0 };
      },
      error: err => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo abrir la cuenta.' })
    });
  }

  limpiarCuenta() {
    this.cuentaSeleccionada.set(null);
    this.posSearch.set('');
  }

  prepararPago(cuenta: CuentaCitaResponse) {
    this.pagoForm = {
      metodoPago: 'EFECTIVO',
      monto: Number(cuenta.saldoPendiente),
      montoRecibido: Number(cuenta.saldoPendiente),
      yapePhoneNumber: '', yapeOtp: '', payerEmail: ''
    };
  }

  agregarDetalle() {
    const cuenta = this.cuentaSeleccionada();
    const descripcion = normalizeText(this.nuevoDetalle.descripcion);
    const cantidad = Number(this.nuevoDetalle.cantidad);
    const precio = Number(this.nuevoDetalle.precioUnitario);
    if (!cuenta || !descripcion || cantidad < 1 || !Number.isFinite(precio) || precio === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Concepto incompleto', detail: 'Ingresa descripción, cantidad y precio válidos.' });
      return;
    }
    this.savingDetalle.set(true);
    this.cajaService.agregarDetalle(cuenta.citaId, {
      ...this.nuevoDetalle, descripcion, cantidad, precioUnitario: Math.abs(precio)
    }).subscribe({
      next: r => {
        this.cuentaSeleccionada.set(r.data);
        this.prepararPago(r.data);
        this.nuevoDetalle = { tipo: 'MEDICAMENTO', descripcion: '', cantidad: 1, precioUnitario: 0 };
        this.savingDetalle.set(false);
        this.cargarPendientes();
      },
      error: err => {
        this.savingDetalle.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se agregó', detail: err?.error?.message ?? 'Revisa los datos del concepto.' });
      }
    });
  }

  eliminarDetalle(detalleId: number) {
    const cuenta = this.cuentaSeleccionada();
    if (!cuenta) return;
    this.cajaService.eliminarDetalle(cuenta.citaId, detalleId).subscribe({
      next: r => {
        this.cuentaSeleccionada.set(r.data);
        this.prepararPago(r.data);
        this.cargarPendientes();
      },
      error: err => this.messageService.add({ severity: 'error', summary: 'No se eliminó', detail: err?.error?.message ?? 'No se pudo eliminar el concepto.' })
    });
  }

  cambiarCantidad(detalle: DetalleCuentaResponse, cambio: number) {
    const cuenta = this.cuentaSeleccionada();
    const cantidad = detalle.cantidad + cambio;
    if (!cuenta || detalle.esServicioBase || cantidad < 1 || cantidad > 999) return;
    this.cajaService.actualizarDetalle(cuenta.citaId, detalle.id, {
      tipo: detalle.tipo,
      descripcion: detalle.descripcion,
      cantidad,
      precioUnitario: Math.abs(Number(detalle.precioUnitario))
    }).subscribe({
      next: r => {
        this.cuentaSeleccionada.set(r.data);
        this.prepararPago(r.data);
        this.cargarPendientes();
      },
      error: err => this.messageService.add({ severity: 'error', summary: 'No se actualizó', detail: err?.error?.message ?? 'No se pudo cambiar la cantidad.' })
    });
  }

  registrarPago() {
    const cuenta = this.cuentaSeleccionada();
    const monto = Number(this.pagoForm.monto);
    if (!cuenta || monto <= 0 || monto > Number(cuenta.saldoPendiente)) {
      this.messageService.add({ severity: 'warn', summary: 'Monto inválido', detail: 'El pago no puede superar el saldo pendiente.' });
      return;
    }
    if (this.pagoForm.metodoPago === 'EFECTIVO' && Number(this.pagoForm.montoRecibido) < monto) {
      this.messageService.add({ severity: 'warn', summary: 'Efectivo insuficiente', detail: 'El monto recibido debe cubrir el pago.' });
      return;
    }
    if (this.pagoForm.metodoPago === 'YAPE' &&
        (this.pagoForm.yapePhoneNumber.length !== 9 || this.pagoForm.yapeOtp.length !== 6 || !this.pagoForm.payerEmail.trim())) {
      this.messageService.add({ severity: 'warn', summary: 'Datos Yape incompletos', detail: 'Ingresa teléfono, OTP y correo del pagador.' });
      return;
    }

    this.savingPago.set(true);
    this.pagoService.registrar({
      citaId: cuenta.citaId,
      metodoPago: this.pagoForm.metodoPago,
      monto,
      ...(this.pagoForm.metodoPago === 'EFECTIVO'
        ? { montoRecibido: Number(this.pagoForm.montoRecibido) }
        : {
            yapePhoneNumber: Number(this.pagoForm.yapePhoneNumber),
            yapeOtp: Number(this.pagoForm.yapeOtp),
            payerEmail: this.pagoForm.payerEmail.trim().toLowerCase()
          })
    }).subscribe({
      next: r => {
        this.savingPago.set(false);
        this.messageService.add({
          severity: 'success', summary: 'Pago registrado',
          detail: r.data?.saldoPendiente ? `Queda un saldo de S/ ${Number(r.data.saldoPendiente).toFixed(2)}` : 'La cuenta quedó pagada.'
        });
        if (Number(r.data?.saldoPendiente ?? 0) > 0) {
          this.cajaService.obtenerCuenta(cuenta.citaId).subscribe(response => {
            this.cuentaSeleccionada.set(response.data);
            this.prepararPago(response.data);
          });
        } else {
          this.limpiarCuenta();
        }
        this.cargarPendientes();
        this.cargar();
      },
      error: err => {
        this.savingPago.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se registró el pago', detail: err?.error?.message ?? 'Intenta nuevamente.' });
      }
    });
  }

  tipoDetalleLabel(tipo: TipoDetalleCuenta): string {
    const labels: Record<TipoDetalleCuenta, string> = {
      SERVICIO: 'Servicio', VACUNA: 'Vacuna', MEDICAMENTO: 'Medicamento', INSUMO: 'Insumo',
      PROCEDIMIENTO: 'Procedimiento', SERVICIO_ADICIONAL: 'Servicio adicional', DESCUENTO: 'Descuento', OTRO: 'Otro'
    };
    return labels[tipo];
  }

  cambioPago(): number {
    return Math.max(0, Number(this.pagoForm.montoRecibido ?? 0) - Number(this.pagoForm.monto ?? 0));
  }

  metodoPagoLabel(metodo: MetodoPago): string {
    const labels: Record<MetodoPago, string> = {
      EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia'
    };
    return labels[metodo];
  }

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

  aplicarFiltros() {
    if (!isDateRangeValid(this.filtroDesde, this.filtroHasta)) {
      this.messageService.add({ severity: 'warn', summary: 'Rango invalido', detail: 'La fecha hasta no puede ser anterior a la fecha desde.' });
      return;
    }
    this.currentPage.set(0);
    this.cargar();
  }

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
    const descripcion = normalizeText(this.egresoForm.descripcion);
    const monto = Number(this.egresoForm.monto);
    if (!monto || !descripcion) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Ingresa monto y descripción.' });
      return;
    }
    if (monto < 0.01 || monto > 50000) {
      this.messageService.add({ severity: 'warn', summary: 'Monto invalido', detail: 'El monto debe estar entre S/ 0.01 y S/ 50,000.00.' });
      return;
    }
    if (descripcion.length > 300 || !hasMeaningfulText(descripcion)) {
      this.messageService.add({ severity: 'warn', summary: 'Descripción inválida', detail: 'Use una descripción válida, sin caracteres especiales no permitidos.' });
      return;
    }
    this.savingEgreso.set(true);
    this.cajaService.registrarEgreso({
      monto,
      descripcion,
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
