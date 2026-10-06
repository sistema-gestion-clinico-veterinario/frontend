import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { CajaService } from '../../../core/services/caja.service';
import { AuthStore } from '../../../store/auth.store';
import { MovimientoCajaResponse, ResumenCajaResponse, SesionCajaResponse } from '../../../models/response/movimiento-caja-response';
import { EstadoEquipo, PuntoCobro } from '../../../models/response/punto-cobro';
import { hasMeaningfulText, isDateRangeValid } from '../../../core/utils/input-validation.util';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { PagoService } from '../../../core/services/pago.service';
import { CuentaCitaResponse, DetalleCuentaRequest, DetalleCuentaResponse, TipoDetalleCuenta } from '../../../models/response/cuenta-cita-response';
import { MetodoPago } from '../../../models/request/pago-request';
import { NotaVentaPdfService, NotaVentaPreview } from '../../../core/services/nota-venta-pdf.service';
import { CompanyService } from '../../../core/services/company.service';
import { ProductoService } from '../../../core/services/producto.service';
import { ProductoResponse } from '../../../models/response/producto-response';
import { CompanyDTO } from '../../../models/request/company-dto';
import { RealtimeStompConnection, RealtimeStompService } from '../../../core/services/realtime-stomp.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { ApoderadoListResponse } from '../../../models/response/apoderado-list-response';
import { VentaLibreService } from '../../../core/services/venta-libre.service';
import { VentaLibreItemRequest } from '../../../models/request/venta-libre-request';
import { etiquetaAplicacionEspecie, EtiquetaAplicacionEspecie, productoCompatibleConEspecie } from '../../../shared/utils/especie-producto.util';

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [FormsModule, ToastModule, PaginatorModule],
  providers: [MessageService],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss'
})
export class CajaComponent implements OnInit, OnDestroy {
  private readonly cajaService   = inject(CajaService);
  private readonly messageService = inject(MessageService);
  private readonly pagoService    = inject(PagoService);
  private readonly notaVentaPdf   = inject(NotaVentaPdfService);
  private readonly sanitizer      = inject(DomSanitizer);
  private readonly companyService = inject(CompanyService);
  private readonly productoService = inject(ProductoService);
  private readonly realtimeStompService = inject(RealtimeStompService);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly ventaLibreService = inject(VentaLibreService);
  readonly authStore             = inject(AuthStore);
  private realtimeConnection: RealtimeStompConnection | null = null;
  private pendingRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  movimientos  = signal<MovimientoCajaResponse[]>([]);
  resumen      = signal<ResumenCajaResponse | null>(null);
  loading      = signal(false);
  totalRecords = signal(0);
  currentPage  = signal(0);
  pageSize     = signal(5);
  readonly pendingPageSize = 20;
  sesionCaja = signal<SesionCajaResponse | null>(null);
  showSesionModal = signal<'ABRIR' | 'ARQUEO' | 'CERRAR' | null>(null);
  savingSesion = signal(false);
  showHistorialSesiones = signal(false);
  estadoEquipo = signal<EstadoEquipo | null>(null);
  puntos = signal<PuntoCobro[]>([]);
  showPuntos = signal(false);
  trabajandoPuntos = signal(false);
  editandoPuntoId = signal<number | null>(null);
  sesionAjenaId = signal<number | null>(null);
  nuevoPuntoNombre = '';
  nombreEditado = '';
  readonly puedeGestionarPuntos = computed(() =>
    this.authStore.isSuperAdmin() || this.authStore.activeRolePurpose() === 'COMPANY_ADMIN');
  readonly equipoSinRegistrar = computed(() => this.estadoEquipo()?.modo === 'NO_REGISTRADO');
  historialSesiones = signal<SesionCajaResponse[]>([]);
  historialSesionesLoading = signal(false);
  historialSesionesPage = signal(0);
  historialSesionesTotal = signal(0);
  readonly historialSesionesSize = 8;
  notaVentaPreview = signal<(NotaVentaPreview & { safeUrl: SafeResourceUrl }) | null>(null);
  sesionForm = { monto: null as number | null, observaciones: '' };

  filtroDesde = '';
  filtroHasta = '';

  showEgresoModal = signal(false);
  egresoForm = { monto: null as number | null, descripcion: '', concepto: 'GASTO_OPERATIVO' as 'GASTO_OPERATIVO' | 'OTRO' };
  savingEgreso = signal(false);

  cuentasPendientes = signal<CuentaCitaResponse[]>([]);
  pendingLoading = signal(false);
  pendingTotal = signal(0);
  pendingPage = signal(0);
  panelActivo = signal<'CITAS' | 'PRODUCTOS'>('CITAS');
  posSearch = signal('');
  cuentasPos = computed(() => {
    const term = normalizeText(this.posSearch()).toLocaleLowerCase('es-PE');
    return this.cuentasPendientes().filter(cuenta => {
      const text = `${cuenta.numeroCita} ${cuenta.mascotaNombre} ${cuenta.apoderadoNombre} ${cuenta.servicioNombre}`.toLocaleLowerCase('es-PE');
      return !term || text.includes(term);
    });
  });
  cuentaSeleccionada = signal<CuentaCitaResponse | null>(null);
  savingDetalle = signal(false);
  savingPago = signal(false);
  nuevoDetalle: DetalleCuentaRequest = {
    tipo: 'MEDICAMENTO', descripcion: '', cantidad: 1, precioUnitario: 0
  };
  productos = signal<ProductoResponse[]>([]);
  productoSearch = signal('');
  productosPos = computed(() => {
    const term = normalizeText(this.productoSearch()).toLocaleLowerCase('es-PE');
    const productos = this.productos().filter(producto => {
      const text = `${producto.nombre} ${producto.categoriaNombre ?? ''} ${producto.marca ?? ''} ${producto.sku ?? ''}`.toLocaleLowerCase('es-PE');
      return (!term || text.includes(term)) && producto.activo;
    });
    const especie = this.cuentaSeleccionada()?.especie;
    if (!especie) return productos;
    return productos.sort((a, b) => {
      const diferenciaCompatibilidad = Number(this.productoCompatible(b, especie)) - Number(this.productoCompatible(a, especie));
      return diferenciaCompatibilidad || a.nombre.localeCompare(b.nombre, 'es-PE');
    });
  });
  productoSeleccionadoId: number | null = null;
  productoUsoExcepcional = signal<ProductoResponse | null>(null);
  justificacionUsoExcepcional = '';

  mostrarVentaRapida = signal(false);
  guardandoVentaRapida = signal(false);
  carritoVentaRapida = signal<{ producto: ProductoResponse; cantidad: number }[]>([]);
  productoVentaRapidaId: number | null = null;
  cantidadVentaRapida = 1;
  clienteQuery = '';
  clientesEncontrados = signal<ApoderadoListResponse[]>([]);
  buscandoClientes = signal(false);
  clienteSeleccionado: ApoderadoListResponse | null = null;
  clienteNombreLibre = '';
  pagoVentaRapida: { metodoPago: MetodoPago; montoRecibido: number | null } = {
    metodoPago: 'EFECTIVO', montoRecibido: null
  };

  totalVentaRapida = computed(() =>
    this.carritoVentaRapida().reduce((sum, linea) => sum + linea.producto.precio * linea.cantidad, 0));
  carritoRequiereReceta = computed(() =>
    this.carritoVentaRapida().some(linea => linea.producto.requiereReceta));
  totalOperacion = computed(() => Number(this.cuentaSeleccionada()?.saldoPendiente ?? this.totalVentaRapida()));
  subtotalSinIgv = computed(() => this.totalOperacion() / 1.18);
  igvIncluido = computed(() => this.totalOperacion() - this.subtotalSinIgv());
  readonly metodosPago: MetodoPago[] = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA'];
  pagoForm: {
    metodoPago: MetodoPago;
    monto: number;
    montoRecibido: number | null;
  } = {
    metodoPago: 'EFECTIVO', monto: 0, montoRecibido: null
  };

  get companyId(): number {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId() ?? 0;
  }

  get requiresCompanySelection(): boolean {
    return this.authStore.isSuperAdmin() && !this.companyId;
  }

  emojiMascota(especie: CuentaCitaResponse['especie'] | null | undefined): string {
    const emojis: Record<CuentaCitaResponse['especie'], string> = {
      PERRO: '🐶',
      GATO: '🐱',
      AVE: '🐦',
      REPTIL: '🦎',
      ROEDOR: '🐹',
      EXOTICO: '🦜',
      OTRO: '🐾'
    };
    return especie ? emojis[especie] : '🐾';
  }

  private async obtenerEncabezadoEmpresaPdf(): Promise<{ empresa: CompanyDTO | null; logoDataUrl: string | null }> {
    const empresa = this.companyId
      ? await firstValueFrom(this.companyService.getById(this.companyId)).then(r => r.data).catch(() => null)
      : null;
    const logoDataUrl = empresa?.logoUrl ? await this.descargarComoDataUrl(empresa.logoUrl) : null;
    return { empresa, logoDataUrl };
  }

  private async descargarComoDataUrl(url: string): Promise<string | null> {
    try {
      const blob = await fetch(url).then(r => r.blob());
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  ngOnInit() {
    if (this.requiresCompanySelection) return;
    this.cargar();
    this.cargarPendientes();
    this.cargarSesion();
    this.cargarEstadoEquipo();
    this.conectarActualizacionCaja();
    this.cargarProductos();
  }

  private cargarProductos() {
    this.productoService.listarActivos(this.companyId || undefined).subscribe({
      next: res => this.productos.set(res.data ?? []),
      error: () => this.productos.set([])
    });
  }

  seleccionarPanel(panel: 'CITAS' | 'PRODUCTOS') {
    this.panelActivo.set(panel);
  }

  agregarProductoOperacion(producto: ProductoResponse) {
    if (producto.stock <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Sin stock', detail: `${producto.nombre} no tiene unidades disponibles.` });
      return;
    }

    const cuenta = this.cuentaSeleccionada();
    if (cuenta) {
      if (!this.productoCompatible(producto, cuenta.especie)) {
        if (!this.puedeAutorizarUsoExcepcional()) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Producto no compatible',
            detail: `${producto.nombre} no está indicado para ${cuenta.mascotaNombre}. Se requiere permiso para crear o editar productos y una justificación clínica.`
          });
          return;
        }
        this.justificacionUsoExcepcional = '';
        this.productoUsoExcepcional.set(producto);
        return;
      }
      this.agregarProductoACuenta(producto);
      return;
    }

    const carrito = this.carritoVentaRapida().map(linea => ({ ...linea }));
    const existente = carrito.find(linea => linea.producto.id === producto.id);
    if (existente) {
      if (existente.cantidad >= producto.stock) {
        this.messageService.add({ severity: 'warn', summary: 'Stock insuficiente', detail: `Solo hay ${producto.stock} unidades disponibles.` });
        return;
      }
      existente.cantidad += 1;
    } else {
      carrito.push({ producto, cantidad: 1 });
    }
    this.carritoVentaRapida.set(carrito);
    this.prepararPagoVentaLibre();
  }

  productoCompatible(producto: ProductoResponse, especie = this.cuentaSeleccionada()?.especie): boolean {
    return productoCompatibleConEspecie(producto.aplicacionEspecie, producto.especies, especie);
  }

  puedeAutorizarUsoExcepcional(): boolean {
    return this.authStore.hasAccess('VISTA_PRODUCTOS', 'escribir')
      || this.authStore.hasAccess('VISTA_PRODUCTOS', 'modificar');
  }

  confirmarUsoExcepcional() {
    const producto = this.productoUsoExcepcional();
    const justificacion = normalizeText(this.justificacionUsoExcepcional);
    if (!producto || this.savingDetalle()) return;
    if (!hasMeaningfulText(justificacion) || justificacion.length < 10) {
      this.messageService.add({ severity: 'warn', summary: 'Justificación requerida', detail: 'Describe el motivo clínico con al menos 10 caracteres.' });
      return;
    }
    this.agregarProductoACuenta(producto, justificacion);
  }

  cerrarUsoExcepcional() {
    if (this.savingDetalle()) return;
    this.productoUsoExcepcional.set(null);
    this.justificacionUsoExcepcional = '';
  }

  private agregarProductoACuenta(producto: ProductoResponse, justificacionUsoExcepcional?: string) {
    const cuenta = this.cuentaSeleccionada();
    if (!cuenta || this.savingDetalle()) return;
    const tipo: TipoDetalleCuenta = producto.categoriaNombre?.toUpperCase().includes('MEDICAMENTO') ? 'MEDICAMENTO' : 'INSUMO';
    this.savingDetalle.set(true);
    this.cajaService.agregarDetalle(cuenta.citaId, {
      tipo,
      descripcion: producto.nombre,
      cantidad: 1,
      precioUnitario: Number(producto.precio),
      productoId: producto.id,
      ...(justificacionUsoExcepcional ? { justificacionUsoExcepcional } : {})
    }).subscribe({
      next: response => {
        this.cuentaSeleccionada.set(response.data);
        this.prepararPago(response.data);
        this.savingDetalle.set(false);
        this.productoUsoExcepcional.set(null);
        this.justificacionUsoExcepcional = '';
        this.cargarPendientes();
      },
      error: err => {
        this.savingDetalle.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se agregó el producto', detail: err?.error?.message ?? 'Intenta nuevamente.' });
      }
    });
  }

  cambiarCantidadProducto(index: number, cambio: number) {
    const carrito = this.carritoVentaRapida().map(linea => ({ ...linea }));
    const linea = carrito[index];
    if (!linea) return;
    const cantidad = linea.cantidad + cambio;
    if (cantidad < 1) {
      carrito.splice(index, 1);
    } else if (cantidad <= linea.producto.stock) {
      linea.cantidad = cantidad;
    } else {
      this.messageService.add({ severity: 'warn', summary: 'Stock insuficiente', detail: `Solo hay ${linea.producto.stock} unidades disponibles.` });
      return;
    }
    this.carritoVentaRapida.set(carrito);
    this.prepararPagoVentaLibre();
  }

  quitarProductoOperacion(index: number) {
    this.quitarDelCarritoVentaRapida(index);
    this.prepararPagoVentaLibre();
  }

  private prepararPagoVentaLibre() {
    const total = this.totalVentaRapida();
    this.pagoForm.monto = total;
    if (this.pagoForm.metodoPago === 'EFECTIVO') this.pagoForm.montoRecibido = total;
  }

  seleccionarMetodoPago(metodo: MetodoPago) {
    this.pagoForm.metodoPago = metodo;
    this.pagoForm.montoRecibido = metodo === 'EFECTIVO' ? this.totalOperacion() : null;
    this.pagoForm.monto = this.totalOperacion();
  }

  limpiarOperacion() {
    this.cuentaSeleccionada.set(null);
    this.carritoVentaRapida.set([]);
    this.clienteSeleccionado = null;
    this.clienteNombreLibre = '';
    this.pagoForm = { metodoPago: 'EFECTIVO', monto: 0, montoRecibido: null };
  }

  registrarOperacion() {
    if (this.cuentaSeleccionada()) {
      this.registrarPago();
      return;
    }
    this.cobrarVentaRapida();
  }

  seleccionarProducto(productoId: number | null) {
    const producto = this.productos().find(p => p.id === productoId);
    if (!producto) return;
    this.nuevoDetalle.descripcion = producto.nombre;
    this.nuevoDetalle.precioUnitario = producto.precio;
    this.nuevoDetalle.tipo = producto.categoriaNombre?.toUpperCase().includes('MEDICAMENTO') ? 'MEDICAMENTO' : 'INSUMO';
    this.nuevoDetalle.productoId = producto.id;
  }

  abrirVentaRapida() {
    this.carritoVentaRapida.set([]);
    this.productoVentaRapidaId = null;
    this.cantidadVentaRapida = 1;
    this.clienteQuery = '';
    this.clientesEncontrados.set([]);
    this.clienteSeleccionado = null;
    this.clienteNombreLibre = '';
    this.pagoVentaRapida = { metodoPago: 'EFECTIVO', montoRecibido: null };
    this.mostrarVentaRapida.set(true);
  }

  cerrarVentaRapida() {
    this.mostrarVentaRapida.set(false);
  }

  agregarAlCarritoVentaRapida() {
    const producto = this.productos().find(p => p.id === this.productoVentaRapidaId);
    if (!producto || this.cantidadVentaRapida < 1) return;

    const carrito = [...this.carritoVentaRapida()];
    const existente = carrito.find(l => l.producto.id === producto.id);
    if (existente) {
      existente.cantidad += this.cantidadVentaRapida;
    } else {
      carrito.push({ producto, cantidad: this.cantidadVentaRapida });
    }
    this.carritoVentaRapida.set(carrito);
    this.productoVentaRapidaId = null;
    this.cantidadVentaRapida = 1;
  }

  quitarDelCarritoVentaRapida(index: number) {
    const carrito = [...this.carritoVentaRapida()];
    carrito.splice(index, 1);
    this.carritoVentaRapida.set(carrito);
  }

  buscarClientesVentaRapida() {
    const query = this.clienteQuery.trim();
    if (!query) { this.clientesEncontrados.set([]); return; }
    this.buscandoClientes.set(true);
    const esDocumento = /^\d+$/.test(query);
    this.apoderadoService.listar(
      this.companyId || undefined,
      esDocumento ? undefined : query,
      esDocumento ? query : undefined,
      0,
      8,
      true
    ).subscribe({
      next: res => {
        this.clientesEncontrados.set((res.data?.content ?? []).filter(cliente => cliente.activo));
        this.buscandoClientes.set(false);
      },
      error: () => {
        this.clientesEncontrados.set([]);
        this.buscandoClientes.set(false);
      }
    });
  }

  seleccionarClienteVentaRapida(cliente: ApoderadoListResponse) {
    this.clienteSeleccionado = cliente;
    this.clienteNombreLibre = '';
    this.clienteQuery = '';
    this.clientesEncontrados.set([]);
  }

  quitarClienteVentaRapida() {
    this.clienteSeleccionado = null;
    this.clienteQuery = '';
  }

  cobrarVentaRapida() {
    const carrito = this.carritoVentaRapida();
    if (carrito.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Carrito vacío', detail: 'Agrega al menos un producto.' });
      return;
    }
    const total = this.totalVentaRapida();
    if (!this.sesionCaja()) {
      this.messageService.add({ severity: 'warn', summary: 'Caja cerrada', detail: 'Abre la caja antes de registrar cobros.' });
      return;
    }
    if (this.pagoForm.metodoPago === 'EFECTIVO') {
      const recibido = Number(this.pagoForm.montoRecibido);
      if (!recibido || recibido < total) {
        this.messageService.add({ severity: 'warn', summary: 'Efectivo inválido', detail: 'El monto recibido debe cubrir el total.' });
        return;
      }
    }

    const items: VentaLibreItemRequest[] = carrito.map(l => ({ productoId: l.producto.id, cantidad: l.cantidad }));

    this.guardandoVentaRapida.set(true);
    this.ventaLibreService.registrar({
      companyId: this.companyId || undefined,
      apoderadoId: this.clienteSeleccionado?.id,
      clienteNombre: this.clienteSeleccionado ? undefined : (this.clienteNombreLibre.trim() || undefined),
      items,
      metodoPago: this.pagoForm.metodoPago,
      montoRecibido: this.pagoForm.metodoPago === 'EFECTIVO' ? Number(this.pagoForm.montoRecibido) : undefined
    }).subscribe({
      next: r => {
        this.guardandoVentaRapida.set(false);
        this.limpiarOperacion();
        this.messageService.add({ severity: 'success', summary: 'Venta registrada', detail: `Total: S/ ${Number(r.data?.total ?? 0).toFixed(2)}` });
        this.cargarProductos();
        this.cargar();
        if (r.data) {
          void this.obtenerEncabezadoEmpresaPdf()
            .then(({ empresa, logoDataUrl }) => this.notaVentaPdf.mostrarVentaLibre(r.data!, empresa, logoDataUrl))
            .then(preview => this.abrirNotaVenta(preview))
            .catch(() => this.messageService.add({
              severity: 'warn', summary: 'Venta registrada',
              detail: 'La venta se guardó, pero no se pudo generar la nota de venta.'
            }));
        }
      },
      error: err => {
        this.guardandoVentaRapida.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se registró la venta', detail: err?.error?.message ?? 'Revisa los datos de la venta.' });
      }
    });
  }

  ngOnDestroy() {
    this.realtimeConnection?.disconnect();
    if (this.pendingRefreshTimer !== null) clearTimeout(this.pendingRefreshTimer);
    this.notaVentaPdf.liberar(this.notaVentaPreview());
  }

  private conectarActualizacionCaja() {
    if (!this.companyId) return;
    const destination = `/topic/caja/${this.companyId}`;
    this.realtimeConnection?.disconnect();
    this.realtimeConnection = this.realtimeStompService.connect<any>(destination, event => {
      if (event?.tipo !== 'CUENTA_PREVENTIVA_CREADA') return;
      if (this.pendingRefreshTimer !== null) clearTimeout(this.pendingRefreshTimer);
      this.pendingRefreshTimer = setTimeout(() => {
        this.pendingRefreshTimer = null;
        this.cargarPendientes(0);
      }, 250);
      this.messageService.add({
        severity: 'info', summary: 'Nueva cuenta preventiva',
        detail: `${event.mascotaNombre} · ${event.control === 'VACUNACION' ? 'Vacunación' : 'Desparasitación'}`
      });
    }, { label: 'Caja' });
  }

  cargarPendientes(page = this.pendingPage()) {
    if (!this.companyId) return;
    this.pendingLoading.set(true);
    this.cajaService.listarPendientes(this.companyId, page, this.pendingPageSize).subscribe({
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
        if (this.carritoVentaRapida().length > 0) this.carritoVentaRapida.set([]);
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
      montoRecibido: Number(cuenta.saldoPendiente)
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
        this.productoSeleccionadoId = null;
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
      precioUnitario: Math.abs(Number(detalle.precioUnitario)),
      productoId: detalle.productoId
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
    if (!this.sesionCaja()) {
      this.messageService.add({ severity: 'warn', summary: 'Caja cerrada', detail: 'Abre la caja antes de registrar cobros.' });
      return;
    }
    if (!cuenta || monto <= 0 || monto > Number(cuenta.saldoPendiente) || monto > 50000) {
      this.messageService.add({ severity: 'warn', summary: 'Monto inválido', detail: 'El pago no puede superar el saldo pendiente.' });
      return;
    }
    if (this.pagoForm.metodoPago === 'EFECTIVO') {
      const recibido = Number(this.pagoForm.montoRecibido);
      if (recibido < monto || recibido > 10000 || recibido - monto > 1000) {
        this.messageService.add({ severity: 'warn', summary: 'Efectivo inválido', detail: 'El recibido debe cubrir el pago, no superar S/ 10,000 ni generar más de S/ 1,000 de vuelto.' });
        return;
      }
    }

    this.savingPago.set(true);
    this.pagoService.registrar({
      citaId: cuenta.citaId,
      metodoPago: this.pagoForm.metodoPago,
      monto,
      ...(this.pagoForm.metodoPago === 'EFECTIVO' ? { montoRecibido: Number(this.pagoForm.montoRecibido) } : {})
    }).subscribe({
      next: r => {
        this.savingPago.set(false);
        if (r.data) {
          void this.obtenerEncabezadoEmpresaPdf()
            .then(({ empresa, logoDataUrl }) => this.notaVentaPdf.mostrar(cuenta, r.data!, empresa, logoDataUrl))
            .then(preview => this.abrirNotaVenta(preview))
            .catch(() => this.messageService.add({
              severity: 'warn',
              summary: 'Pago registrado',
              detail: 'El pago se guardó, pero no se pudo generar la nota de venta.'
            }));
        }
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

  limitarMontoRecibido(valor: number | null) {
    if (valor == null || !Number.isFinite(Number(valor))) {
      this.pagoForm.montoRecibido = null;
      return;
    }
    this.pagoForm.montoRecibido = Math.min(10000, Math.max(0, Number(valor)));
  }

  cargarSesion() {
    if (!this.companyId) return;
    this.cajaService.obtenerSesion(this.companyId).subscribe({
      next: r => this.sesionCaja.set(r.data ?? null),
      error: () => this.sesionCaja.set(null)
    });
  }

  cargarEstadoEquipo() {
    if (!this.companyId) return;
    this.cajaService.esteEquipo(this.companyId).subscribe({
      next: r => this.estadoEquipo.set(r.data ?? null),
      error: () => this.estadoEquipo.set(null)
    });
  }

  abrirPuntos() {
    this.showPuntos.set(true);
    this.cargarPuntos();
  }

  cargarPuntos() {
    if (!this.companyId) return;
    this.trabajandoPuntos.set(true);
    this.cajaService.puntosCobro(this.companyId).subscribe({
      next: r => { this.puntos.set(r.data ?? []); this.trabajandoPuntos.set(false); },
      error: () => {
        this.trabajandoPuntos.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se cargaron los puntos de cobro', detail: 'Intenta nuevamente.' });
      }
    });
  }

  private despuesDeCambiarPuntos(exito: string) {
    this.messageService.add({ severity: 'success', summary: exito });
    this.cargarPuntos();
    this.cargarEstadoEquipo();
    this.cargarSesion();
  }

  private falloPuntos(err: any) {
    this.trabajandoPuntos.set(false);
    this.messageService.add({ severity: 'error', summary: 'No se completó la operación', detail: err?.error?.message ?? 'Intenta nuevamente.' });
  }

  crearPunto() {
    const nombre = normalizeText(this.nuevoPuntoNombre);
    if (!nombre || nombre.length < 2) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre inválido', detail: 'Escribe un nombre de al menos 2 caracteres.' });
      return;
    }
    this.trabajandoPuntos.set(true);
    this.cajaService.crearPuntoCobro(this.companyId, nombre).subscribe({
      next: () => { this.nuevoPuntoNombre = ''; this.despuesDeCambiarPuntos('Punto de cobro creado'); },
      error: err => this.falloPuntos(err)
    });
  }

  empezarARenombrar(punto: PuntoCobro) {
    this.editandoPuntoId.set(punto.id);
    this.nombreEditado = punto.nombre;
  }

  guardarNombrePunto(punto: PuntoCobro) {
    const nombre = normalizeText(this.nombreEditado);
    if (!nombre || nombre.length < 2) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre inválido', detail: 'Escribe un nombre de al menos 2 caracteres.' });
      return;
    }
    this.trabajandoPuntos.set(true);
    this.cajaService.actualizarPuntoCobro(punto.id, this.companyId, nombre).subscribe({
      next: () => { this.editandoPuntoId.set(null); this.despuesDeCambiarPuntos('Nombre actualizado'); },
      error: err => this.falloPuntos(err)
    });
  }

  cambiarActividadPunto(punto: PuntoCobro) {
    this.trabajandoPuntos.set(true);
    this.cajaService.actualizarPuntoCobro(punto.id, this.companyId, punto.nombre, !punto.activa).subscribe({
      next: () => this.despuesDeCambiarPuntos(punto.activa ? 'Punto de cobro desactivado' : 'Punto de cobro activado'),
      error: err => this.falloPuntos(err)
    });
  }

  vincularPunto(punto: PuntoCobro) {
    this.trabajandoPuntos.set(true);
    this.cajaService.vincularPuntoCobro(punto.id, this.companyId).subscribe({
      next: () => this.despuesDeCambiarPuntos('Este equipo quedó registrado'),
      error: err => this.falloPuntos(err)
    });
  }

  desvincularPunto(punto: PuntoCobro) {
    this.trabajandoPuntos.set(true);
    this.cajaService.desvincularPuntoCobro(punto.id, this.companyId).subscribe({
      next: () => this.despuesDeCambiarPuntos('Se quitó el equipo del punto de cobro'),
      error: err => this.falloPuntos(err)
    });
  }

  cerrarSesionAjena(sesion: SesionCajaResponse) {
    this.abrirModalSesion('CERRAR');
    this.sesionAjenaId.set(sesion.id);
    this.sesionForm.monto = Number(sesion.efectivoEsperado ?? 0);
  }

  abrirHistorialSesiones() {
    if (!this.companyId) return;
    this.showHistorialSesiones.set(true);
    this.cargarHistorialSesiones(0);
  }

  cargarHistorialSesiones(page: number) {
    if (!this.companyId) return;
    this.historialSesionesLoading.set(true);
    this.cajaService.listarSesiones(this.companyId, page, this.historialSesionesSize).subscribe({
      next: r => {
        this.historialSesiones.set(r.data?.content ?? []);
        this.historialSesionesPage.set((r.data as any)?.page?.number ?? r.data?.number ?? page);
        this.historialSesionesTotal.set((r.data as any)?.page?.totalElements ?? r.data?.totalElements ?? 0);
        this.historialSesionesLoading.set(false);
      },
      error: () => {
        this.historialSesionesLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se cargó el historial', detail: 'Intenta nuevamente.' });
      }
    });
  }

  abrirNotaVenta(preview: NotaVentaPreview) {
    this.notaVentaPdf.liberar(this.notaVentaPreview());
    this.notaVentaPreview.set({ ...preview, safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(preview.url) });
  }

  cerrarNotaVenta() {
    const preview = this.notaVentaPreview();
    this.notaVentaPreview.set(null);
    this.notaVentaPdf.liberar(preview);
  }

  descargarNotaVenta() {
    const preview = this.notaVentaPreview();
    if (preview) this.notaVentaPdf.descargar(preview);
  }

  abrirModalSesion(tipo: 'ABRIR' | 'ARQUEO' | 'CERRAR') {
    this.sesionAjenaId.set(null);
    this.sesionForm = {
      monto: tipo === 'ABRIR' ? 0 : Number(this.sesionCaja()?.efectivoEsperado ?? 0),
      observaciones: ''
    };
    this.showSesionModal.set(tipo);
  }

  guardarSesion() {
    const tipo = this.showSesionModal();
    const monto = Number(this.sesionForm.monto);
    if (!tipo || !Number.isFinite(monto) || monto < 0 || monto > (tipo === 'ABRIR' ? 10000 : 100000)) {
      this.messageService.add({ severity: 'warn', summary: 'Monto inválido', detail: 'Revisa el efectivo ingresado.' });
      return;
    }
    this.savingSesion.set(true);
    const request = tipo === 'ABRIR'
      ? this.cajaService.abrirCaja(this.companyId, monto)
      : tipo === 'ARQUEO'
        ? this.cajaService.arquearCaja(this.companyId, monto, normalizeText(this.sesionForm.observaciones))
        : this.cajaService.cerrarCaja(this.companyId, monto, normalizeText(this.sesionForm.observaciones), this.sesionAjenaId() ?? undefined);
    const cierraLaDeOtra = tipo === 'CERRAR' && this.sesionAjenaId() !== null;
    request.subscribe({
      next: r => {
        if (!cierraLaDeOtra) this.sesionCaja.set(tipo === 'CERRAR' ? null : r.data);
        this.sesionAjenaId.set(null);
        this.showSesionModal.set(null);
        this.savingSesion.set(false);
        this.cargar();
        if (this.showHistorialSesiones()) this.cargarHistorialSesiones(0);
        this.messageService.add({ severity: 'success', summary: tipo === 'ABRIR' ? 'Caja abierta' : tipo === 'ARQUEO' ? 'Arqueo registrado' : 'Caja cerrada' });
      },
      error: err => {
        this.savingSesion.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se completó la operación', detail: err?.error?.message ?? 'Intenta nuevamente.' });
      }
    });
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
    if (!this.sesionCaja()) {
      this.messageService.add({ severity: 'warn', summary: 'Caja cerrada', detail: 'Abre la caja antes de registrar egresos.' });
      return;
    }
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
      VENTA_PRODUCTO: 'Venta de producto',
      CANCELACION_DEVOLUCION: 'Dev. cancelación',
      GASTO_OPERATIVO: 'Gasto operativo',
      OTRO: 'Otro'
    };
    return map[c] ?? c;
  }

  responsable(nombre?: string | null, correo?: string | null): string {
    return nombre || correo || '—';
  }

  formatFecha(f: string): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatMonto(m: number | null): string {
    return m != null ? `S/ ${Number(m).toFixed(2)}` : '—';
  }

  /** Etiqueta del catálogo: "Uso general" o "Para: perros y gatos". */
  etiquetaAplicacion(producto: ProductoResponse): EtiquetaAplicacionEspecie | null {
    return etiquetaAplicacionEspecie(producto.aplicacionEspecie, producto.especies);
  }

  formatFechaActual(): string {
    return new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
