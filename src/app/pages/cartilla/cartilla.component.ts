import { Component, OnInit, inject, signal, computed, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { CartillaService } from '../../core/services/cartilla.service';
import { ControlPreventivoService } from '../../core/services/control-preventivo.service';
import { MascotaService } from '../../core/services/mascota.service';
import { ServicioService } from '../../core/services/servicio.service';
import { MascotaResponse } from '../../models/response/mascota-response';
import { MascotaCartillaResponse } from '../../models/response/mascota-cartilla-response';
import { ServicioResponse } from '../../models/response/servicio-response';
import { ControlPreventivoResponse, TipoControlPreventivo } from '../../models/response/control-preventivo-response';
import { AplicacionPreventiva, TipoVacuna, TipoDesparasitante, CartillaAplicacionResponse, IntervaloUnidad } from '../../models/cartilla.model';
import { AuthStore } from '../../store/auth.store';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-cartilla',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    DialogModule,
    TooltipModule,
    PaginatorModule,
    SkeletonModule
  ],
  providers: [MessageService],
  templateUrl: './cartilla.component.html',
  styleUrl: './cartilla.component.scss'
})
export class CartillaComponent implements OnInit {
  private readonly cartillaService         = inject(CartillaService);
  private readonly preventivoService       = inject(ControlPreventivoService);
  private readonly mascotaService          = inject(MascotaService);
  private readonly servicioService         = inject(ServicioService);
  private readonly msgService              = inject(MessageService);
  readonly authStore                       = inject(AuthStore);
  private readonly router                  = inject(Router);
  private readonly route                   = inject(ActivatedRoute);

  readonly modo = signal<'VACUNACION' | 'DESPARASITACION'>('VACUNACION');
  cargando = signal(true);

  // Búsqueda / selección de mascota
  searchQuery        = '';
  resultados         = signal<MascotaResponse[]>([]);
  mascotaSugerencias = signal<MascotaResponse[]>([]);
  mascotaSel         = signal<MascotaResponse | null>(null);
  mascotaModel: MascotaResponse | null = null;
  buscando           = signal(false);
  showDropdown       = signal(false);
  dropdownAbierto    = false;

  // Listado de mascotas con vacunación
  mascotasLista      = signal<MascotaCartillaResponse[]>([]);
  filtroEspecie      = '';
  paginaActual       = 0;
  totalPaginas       = 0;
  totalRegistros     = 0;
  readonly tamanoPagina = 10;

  // Aplicación
  serviciosPreventivos = signal<ServicioResponse[]>([]);
  servicioId: number | null = null;
  tipoVacunaId: number | null = null;
  tipoDesparasitanteId: number | null = null;
  tipoProducto = '';
  tiposVacuna = signal<TipoVacuna[]>([]);
  tiposDesparasitante = signal<TipoDesparasitante[]>([]);
  fechaAplicacion = '';
  intervaloCantidad = 3;
  intervaloUnidad: IntervaloUnidad = 'MESES';
  fechaProxima = '';
  lote = '';
  fechaVencimientoProducto = '';
  dosis: number | null = null;
  unidadDosis = '';
  viaAdministracion = '';
  sitioAplicacion = '';
  pesoKg: number | null = null;
  observaciones = '';
  programarProximoControl = true;
  readonly unidadesIntervalo = [
    { label: 'Días', value: 'DIAS' },
    { label: 'Semanas', value: 'SEMANAS' },
    { label: 'Meses', value: 'MESES' }
  ];
  readonly fechaHoyLima = this.fechaLocalLima();

  readonly precioSeleccionado = computed(() => {
    if (this.modo() === 'VACUNACION') {
      return this.tiposVacuna().find((v) => v.id === this.tipoVacunaId)?.precio ?? null;
    }
    return this.tiposDesparasitante().find((d) => d.id === this.tipoDesparasitanteId)?.precio ?? null;
  });

  // Control preventivo seleccionado para aplicar
  controlActivo = signal<ControlPreventivoResponse | null>(null);

  // Controles preventivos de la mascota
  controles      = signal<ControlPreventivoResponse[]>([]);
  cargandoCtrl   = signal(false);
  controlReprogramandoId = signal<number | null>(null);
  fechaReprogramacion    = signal('');
  fechaReprogramacionCalendario: Date | null = null;
  controlReprogramando = signal<ControlPreventivoResponse | null>(null);
  controlCancelar = signal<ControlPreventivoResponse | null>(null);

  // Programar control futuro
  mostrarProgramar = signal(false);
  progTipo         = 'VACUNACION' as TipoControlPreventivo;
  progTipoVacunaId = null as number | null;
  progNombreControl = '';
  progFecha        = '';
  progFechaCalendario: Date | null = null;

  // Resultado
  resultado = signal<CartillaAplicacionResponse | null>(null);
  matriz    = signal<AplicacionPreventiva[]>([]);
  guardando = signal(false);

  readonly tipoConfig = computed(() =>
    this.modo() === 'VACUNACION'
      ? { titulo: 'Cartilla de Vacunación', check: 'vacuna' }
      : { titulo: 'Cartilla de Desparasitación', check: 'desparasitación' }
  );

  readonly controlesOrdenados = computed(() =>
    this.controles()
      .filter((c) => c.tipo === this.modo() && c.estado !== 'APLICADO')
      .sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada))
  );

  readonly controlesAtrasados = computed(() =>
    this.controlesOrdenados().filter(c => c.estado === 'ATRASADO').length
  );

  readonly controlesProgramados = computed(() =>
    this.controlesOrdenados().filter(c => c.estado !== 'ATRASADO').length
  );

  readonly serviciosModo = computed(() => this.serviciosPreventivos().filter((s) =>
    s.tipoControlPreventivo === this.modo()
  ));

  readonly vacunasMatriz = computed(() => this.matriz().filter((a) => a.tipo === 'VACUNACION'));
  readonly desparasitacionesMatriz = computed(() => this.matriz().filter((a) => a.tipo === 'DESPARASITACION'));
  readonly aplicacionesModo = computed(() => this.modo() === 'VACUNACION'
    ? this.vacunasMatriz() : this.desparasitacionesMatriz());

  readonly totalVacunas = computed(() => this.vacunasMatriz().length);
  readonly totalDesparasitaciones = computed(() => this.desparasitacionesMatriz().length);

  readonly proximaAplicacion = computed(() => {
    const pendientes = this.controles()
      .filter((c) => c.tipo === this.modo() && c.estado !== 'APLICADO' && c.estado !== 'CANCELADO')
      .map((c) => c.fechaRecomendada);
    return pendientes.length ? pendientes.sort((a, b) => a.localeCompare(b))[0] : '—';
  });

  readonly etiquetaProximaAplicacion = computed(() => {
    const fecha = this.proximaAplicacion();
    if (fecha === '—') return 'Sin controles pendientes';
    if (fecha < this.fechaHoyLima) return 'Control más atrasado';
    if (fecha === this.fechaHoyLima) return 'Aplicación para hoy';
    return 'Próxima aplicación';
  });

  ngOnInit() {
    if (!this.companyId) {
      this.cargando.set(false);
      return;
    }
    this.cargarServiciosPreventivos();
    this.cargarMascotas();
    const petId = Number(this.route.snapshot.queryParamMap.get('petId'));
    if (Number.isInteger(petId) && petId > 0) {
      this.mascotaService.obtenerPorId(petId).subscribe({
        next: response => this.onAutocompleteSelect(response.data)
      });
    }
  }

  abrirWhatsAppMascota(m: MascotaCartillaResponse) {
    const tel = m.apoderadoTelefono?.replace(/\D/g, '');
    if (!tel) {
      this.msgService.add({ severity: 'warn', summary: 'Sin teléfono', detail: 'El apoderado no tiene número registrado' });
      return;
    }
    const nombre = m.nombreCompleto;
    const cliente = m.apoderadoNombreCompleto?.trim().split(/\s+/)[0] || 'estimado cliente';
    const veterinaria = this.authStore.selectedEnterprise()?.name || this.authStore.companyName() || 'la clínica veterinaria';
    const control = m.controlPendienteNombre || 'su control preventivo';
    const tipo = m.controlPendienteTipo === 'VACUNACION'
      ? 'Vacunación'
      : m.controlPendienteTipo === 'DESPARASITACION' ? 'Desparasitación' : 'Control preventivo';
    const fecha = this.formatearFechaRecordatorio(m.controlPendienteFecha);
    const resumen = m.controlPendienteResumen || 'Pendiente de coordinación';
    const msg = encodeURIComponent(
      `Hola, ${cliente} 👋\n\n` +
      `Te escribimos de *${veterinaria}* para recordarte el control preventivo de *${nombre}*.\n\n` +
      `🩺 *Control:* ${tipo} — ${control}\n` +
      `${fecha ? `📅 *Fecha recomendada:* ${fecha}\n` : ''}` +
      `⏳ *Estado:* ${resumen}\n\n` +
      `Para programar la atención o realizar una consulta, responde a este mensaje.`
    );
    window.open(`https://wa.me/51${tel}?text=${msg}`, '_blank');
  }

  private formatearFechaRecordatorio(fecha: string | null): string {
    if (!fecha) return '';
    const partes = fecha.substring(0, 10).split('-');
    if (partes.length !== 3) return fecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  cargarMascotas(especie?: string) {
    this.cargando.set(true);
    this.cartillaService.listarMascotasConCartilla(
      this.companyId,
      especie || undefined,
      this.paginaActual,
      this.tamanoPagina
    ).subscribe({
      next: (res) => {
        const page = res.data;
        this.mascotasLista.set(page?.content ?? []);
        this.totalPaginas = page?.totalPages ?? 0;
        this.totalRegistros = page?.totalElements ?? 0;
      },
      error: () => {
        this.mascotasLista.set([]);
        this.totalPaginas = 0;
        this.totalRegistros = 0;
      },
      complete: () => {
        this.cargando.set(false);
      }
    });
  }

  filtrarPorEspecie(especie: string) {
    this.filtroEspecie = especie;
    this.paginaActual = 0;
    this.cargarMascotas(especie);
  }

  cambiarPagina(event: any) {
    this.paginaActual = event.page;
    this.cargarMascotas(this.filtroEspecie || undefined);
  }

  private cargarServiciosPreventivos() {
    this.servicioService.listarDisponibles(this.companyId).subscribe({
      next: (res) =>
        this.serviciosPreventivos.set(
          (res.data ?? []).filter((s) => s.tipoControlPreventivo && s.tipoControlPreventivo !== 'NO_APLICA')
        ),
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los servicios preventivos' })
    });
  }

  private get companyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId() ?? undefined;
  }

  get requiresCompanySelection(): boolean {
    return this.authStore.isSuperAdmin() && !this.companyId;
  }

  buscar() {
    const q = this.searchQuery?.trim();
    if (!q) return;
    this.buscando.set(true);
    this.mascotaService.listar(this.companyId, q, undefined, 0, 20, true, true).subscribe({
      next: (res) => this.resultados.set((res.data?.content ?? [])),
      error: () => this.resultados.set([]),
      complete: () => this.buscando.set(false)
    });
  }

  onFilterMascota(query: string) {
    const q = query?.trim();
    if (!q || q.length < 2) { this.mascotaSugerencias.set([]); this.showDropdown.set(false); return; }
    this.buscando.set(true);
    this.showDropdown.set(true);
    this.mascotaService.listar(this.companyId, q, undefined, 0, 20, true, true).subscribe({
      next: (res) => {
        const lista = (res.data?.content ?? []);
        const yaSeleccionado = this.mascotaSel();
        this.mascotaSugerencias.set(yaSeleccionado ? [yaSeleccionado, ...lista.filter(m => m.id !== yaSeleccionado.id)] : lista);
      },
      error: () => this.mascotaSugerencias.set([]),
      complete: () => this.buscando.set(false)
    });
  }

  cerrarDropdown() {
    setTimeout(() => this.showDropdown.set(false), 200);
  }

  onAutocompleteSelect(value: MascotaResponse) {
    this.mascotaSel.set(value);
    this.mascotaModel = value;
    this.searchQuery = value.nombreCompleto;
    this.resultados.set([]);
    this.cargarDatosMascota(value.id);
  }

  buscarMascotaDesdeBarra() {
    const primera = this.mascotaSugerencias()[0];
    if (primera) {
      this.onAutocompleteSelect(primera);
      return;
    }
    this.msgService.add({
      severity: 'info',
      summary: 'Selecciona un paciente',
      detail: 'Escribe el nombre y selecciona una mascota de los resultados.'
    });
  }

  seleccionarMascota(m: MascotaCartillaResponse) {
    this.searchQuery = m.nombreCompleto;
    this.mascotaService.obtenerPorId(m.id).subscribe({
      next: (res) => {
        this.mascotaSel.set(res.data);
        this.cargarDatosMascota(m.id);
      }
    });
  }

  volver() {
    this.mascotaSel.set(null);
    this.searchQuery = '';
    this.mascotaSugerencias.set([]);
    this.showDropdown.set(false);
  }

  editarAplicacion(aplicacion: AplicacionPreventiva) {
    this.msgService.add({
      severity: 'info',
      summary: 'Editar aplicación',
      detail: `Editar ${aplicacion.nombreControl} — funcionalidad en desarrollo`
    });
  }

  confirmarToggleEstado(aplicacion: AplicacionPreventiva) {
    const activo = aplicacion.activo === false;
    const servicio = aplicacion.tipo === 'VACUNACION'
      ? this.cartillaService.cambiarEstadoVacunacion(aplicacion.id, activo)
      : this.cartillaService.cambiarEstadoDesparasitacion(aplicacion.id, activo);

    servicio.subscribe({
      next: () => {
        this.msgService.add({
          severity: activo ? 'success' : 'warn',
          summary: activo ? 'Activada' : 'Desactivada',
          detail: `${aplicacion.nombreControl} ${activo ? 'activada' : 'desactivada'} correctamente`
        });
        this.cargarMatriz(this.mascotaSel()!.id);
      },
      error: () => {
        this.msgService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cambiar el estado'
        });
      }
    });
  }

  private cargarDatosMascota(petId: number) {
    this.cargandoCtrl.set(true);
    this.cartillaService.obtenerDetalle(petId).subscribe({
      next: ({ data }) => {
        this.tiposVacuna.set(data.vacunas ?? []);
        this.tiposDesparasitante.set(data.desparasitantes ?? []);
        this.controles.set(data.controles ?? []);
        this.matriz.set(data.aplicaciones ?? []);
        this.controlReprogramandoId.set(null);
      },
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la cartilla' }),
      complete: () => this.cargandoCtrl.set(false)
    });
  }

  private cargarTiposVacuna(petId: number) {
    this.preventivoService.listarTiposVacuna(petId).subscribe({
      next: (res) => this.tiposVacuna.set(res.data ?? []),
      error: () => this.msgService.add({ severity: 'warn', summary: 'Aviso', detail: 'No se pudieron cargar los tipos de vacuna' })
    });
  }

  private cargarTiposDesparasitante(petId: number) {
    this.cartillaService.listarTiposDesparasitante(petId).subscribe({
      next: (res) => this.tiposDesparasitante.set(res.data ?? []),
      error: () => this.msgService.add({ severity: 'warn', summary: 'Aviso', detail: 'No se pudieron cargar los desparasitantes' })
    });
  }

  private cargarControles(petId: number) {
    this.cargandoCtrl.set(true);
    this.preventivoService.listarControles(petId).subscribe({
      next: (res) => {
        this.controles.set(res.data ?? []);
        this.controlReprogramandoId.set(null);
      },
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los controles preventivos' }),
      complete: () => this.cargandoCtrl.set(false)
    });
  }

  cambiarModo(modo: 'VACUNACION' | 'DESPARASITACION') {
    this.modo.set(modo);
    this.resultado.set(null);
    this.controlActivo.set(null);
    this.servicioId = null;
    this.intervaloCantidad = modo === 'VACUNACION' ? 12 : 3;
    this.intervaloUnidad = 'MESES';
    const m = this.mascotaSel();
    if (!m) return;
  }

  registrarNuevaMascota() {
    this.router.navigate(['/mascotas/form'], { queryParams: { returnUrl: '/historias-clinicas/cartilla' } });
  }

  prepararAplicacion(control: ControlPreventivoResponse) {
    this.controlActivo.set(control);
    this.modo.set(control.tipo);
    this.resultado.set(null);
    if (control.tipo === 'VACUNACION') {
      this.tipoVacunaId = control.tipoVacunaId ?? null;
      this.intervaloCantidad = control.tipoVacunaId
        ? (this.tiposVacuna().find(v => v.id === control.tipoVacunaId)?.periodicidadMesesSugerida ?? this.intervaloCantidad)
        : this.intervaloCantidad;
      this.intervaloUnidad = 'MESES';
    } else {
      this.tipoDesparasitanteId = null;
      this.tipoVacunaId = null;
    }
    const servicios = this.serviciosPreventivos().filter(s => s.tipoControlPreventivo === control.tipo);
    this.servicioId = servicios.length === 1 ? servicios[0].id : null;
    this.fechaAplicacion = this.fechaLocalLima();
  }

  actualizarIntervaloSugerido(id: number | null) {
    if (!id) return;
    const meses = this.modo() === 'VACUNACION'
      ? this.tiposVacuna().find(v => v.id === id)?.periodicidadMesesSugerida
      : this.tiposDesparasitante().find(d => d.id === id)?.periodicidadMesesSugerida;
    if (meses) {
      this.intervaloCantidad = meses;
      this.intervaloUnidad = 'MESES';
    }
    const producto = this.modo() === 'VACUNACION'
      ? this.tiposVacuna().find(v => v.id === id)
      : this.tiposDesparasitante().find(d => d.id === id);
    this.lote = producto?.lote ?? '';
    this.fechaVencimientoProducto = producto?.fechaVencimientoProducto ?? '';
    this.dosis = producto?.dosis ?? null;
    this.unidadDosis = producto?.unidadDosis ?? '';
    this.viaAdministracion = producto?.viaAdministracion ?? '';
  }

  iniciarReprogramacion(control: ControlPreventivoResponse) {
    this.controlReprogramandoId.set(control.id);
    this.fechaReprogramacion.set(control.fechaRecomendada);
    this.fechaReprogramacionCalendario = this.desdeFechaIso(control.fechaRecomendada);
    this.controlReprogramando.set(control);
  }

  guardarReprogramacion(control: ControlPreventivoResponse) {
    const fecha = this.fechaReprogramacion();
    if (!fecha) return;
    this.guardando.set(true);
    this.preventivoService.reprogramar(control.id, fecha).subscribe({
      next: () => {
        this.cerrarReprogramacion();
        this.msgService.add({ severity: 'success', summary: 'Control reprogramado', detail: 'Fecha recomendada actualizada' });
        this.recargarMascota();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo reprogramar el control' }),
      complete: () => this.guardando.set(false)
    });
  }

  solicitarCancelarControl(control: ControlPreventivoResponse) {
    this.controlCancelar.set(control);
  }

  cancelarControl() {
    const control = this.controlCancelar();
    if (!control) return;
    this.guardando.set(true);
    this.preventivoService.cancelar(control.id).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Control cancelado', detail: control.nombreControl });
        this.controlCancelar.set(null);
        this.recargarMascota();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cancelar el control' }),
      complete: () => this.guardando.set(false)
    });
  }

  abrirProgramar() {
    this.mostrarProgramar.set(true);
    this.progTipo = this.modo();
    this.progFecha = this.fechaLocalLima();
    this.progFechaCalendario = this.desdeFechaIso(this.progFecha);
  }

  programarControl() {
    const m = this.mascotaSel();
    if (!m) { this.msgService.add({ severity: 'warn', summary: 'Falta mascota', detail: 'Seleccione la mascota' }); return; }
    if (this.progTipo === 'VACUNACION' && !this.progTipoVacunaId) {
      this.msgService.add({ severity: 'warn', summary: 'Falta vacuna', detail: 'Seleccione la vacuna' }); return;
    }
    if (this.progTipo === 'DESPARASITACION' && !this.progNombreControl?.trim()) {
      this.msgService.add({ severity: 'warn', summary: 'Falta producto', detail: 'Indique el producto' }); return;
    }
    if (!this.progFecha) { this.msgService.add({ severity: 'warn', summary: 'Falta fecha', detail: 'Indique la fecha recomendada' }); return; }

    this.guardando.set(true);
    this.preventivoService.programar(m.id, {
      tipo: this.progTipo,
      tipoVacunaId: this.progTipo === 'VACUNACION' ? this.progTipoVacunaId! : undefined,
      nombreControl: this.progTipo === 'DESPARASITACION' ? this.progNombreControl.trim() : undefined,
      fechaRecomendada: this.progFecha,
    }).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Control programado', detail: 'Se notificará al apoderado cuando se acerque la fecha' });
        this.mostrarProgramar.set(false);
        this.progNombreControl = '';
        this.progTipoVacunaId = null;
        this.recargarMascota();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo programar el control' }),
      complete: () => this.guardando.set(false)
    });
  }

  guardar() {
    const m = this.mascotaSel();
    if (!m) { this.msgService.add({ severity: 'warn', summary: 'Falta mascota', detail: 'Seleccione o registre la mascota' }); return; }
    if (this.modo() === 'VACUNACION' && !this.tipoVacunaId) { this.msgService.add({ severity: 'warn', summary: 'Falta vacuna', detail: 'Seleccione la vacuna' }); return; }
    if (this.modo() === 'DESPARASITACION' && !this.tipoDesparasitanteId) { this.msgService.add({ severity: 'warn', summary: 'Falta desparasitante', detail: 'Seleccione el desparasitante' }); return; }
    if (!this.fechaAplicacion) { this.msgService.add({ severity: 'warn', summary: 'Falta fecha', detail: 'Indique la fecha de aplicación' }); return; }
    if (this.dosis != null && !this.unidadDosis.trim()) {
      this.msgService.add({ severity: 'warn', summary: 'Falta unidad', detail: 'Indique la unidad de la dosis' }); return;
    }

    const req = {
      mascotaId: m.id,
      controlPreventivoId: this.controlActivo()?.id,
      servicioId: this.serviciosModo()[0]?.id,
      fechaAplicacion: this.fechaAplicacion,
      programarProximoControl: this.programarProximoControl,
      intervaloCantidad: this.programarProximoControl && !this.fechaProxima ? this.intervaloCantidad : undefined,
      intervaloUnidad: this.programarProximoControl && !this.fechaProxima ? this.intervaloUnidad : undefined,
      fechaProxima: this.programarProximoControl ? (this.fechaProxima || undefined) : undefined,
      sitioAplicacion: this.sitioAplicacion.trim() || undefined,
      pesoKg: this.pesoKg ?? undefined,
      observaciones: this.observaciones.trim() || undefined,
      ...(this.modo() === 'VACUNACION' ? { tipoVacunaId: this.tipoVacunaId! } : { tipoDesparasitanteId: this.tipoDesparasitanteId! })
    };

    this.guardando.set(true);
    const call = this.modo() === 'VACUNACION'
      ? this.cartillaService.registrarVacunacion(req)
      : this.cartillaService.registrarDesparasitacion(req);

    call.subscribe({
      next: (res) => {
        this.resultado.set(res.data);
        this.limpiarAplicacion();
        this.msgService.add({ severity: 'success', summary: 'Aplicación registrada', detail: 'La cuenta fue enviada automáticamente a Caja.' });
        this.recargarMascota();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar' }),
      complete: () => this.guardando.set(false)
    });
  }

  private recargarMascota() {
    const m = this.mascotaSel();
    if (!m) return;
    this.cargarDatosMascota(m.id);
  }

  private limpiarAplicacion() {
    this.controlActivo.set(null);
    this.fechaProxima = '';
    this.lote = '';
    this.fechaVencimientoProducto = '';
    this.dosis = null;
    this.unidadDosis = '';
    this.viaAdministracion = '';
    this.sitioAplicacion = '';
    this.pesoKg = null;
    this.observaciones = '';
  }

  private cargarMatriz(petId: number) {
    this.cartillaService.obtenerMatriz(petId).subscribe({
      next: (res) => this.matriz.set(res.data ?? []),
      error: () => this.matriz.set([])
    });
  }

  claseEstadoPreventivo(estado: string) {
    if (estado === 'ATRASADO') return 'rounded-lg bg-red-700 px-2.5 py-1 text-white font-bold';
    if (estado === 'CANCELADO') return 'text-slate-500 font-bold';
    if (estado === 'PENDIENTE' || estado === 'PROXIMO') return 'text-amber-700 font-bold';
    if (estado === 'SUSPENDIDO_POR_CITA') return 'text-[#0066AA] font-bold';
    return 'text-slate-700 font-bold';
  }

  etiquetaEstadoPreventivo(estado: string) {
    const etiquetas: Record<string, string> = {
      PROGRAMADO: 'Programado',
      PROXIMO: 'Vence próximamente',
      PENDIENTE: 'Debe aplicarse hoy',
      ATRASADO: 'Control vencido',
      SUSPENDIDO_POR_CITA: 'Cita programada',
      APLICADO: 'Aplicado',
      CANCELADO: 'Cancelado'
    };
    return etiquetas[estado] ?? estado;
  }

  severidadEstadoPreventivo(estado: string) {
    if (estado === 'ATRASADO') return 'danger';
    if (estado === 'PENDIENTE' || estado === 'PROXIMO') return 'warn';
    if (estado === 'SUSPENDIDO_POR_CITA') return 'info';
    if (estado === 'CANCELADO') return 'contrast';
    return 'success';
  }

  tipoLabel(tipo: string) {
    return tipo === 'VACUNACION' ? 'Vacunación' : 'Desparasitación';
  }

  parteFecha(fecha: string | undefined, parte: 'day' | 'month' | 'year') {
    if (!fecha || fecha === '—') return '—';
    const [year, month, day] = fecha.split('-').map(Number);
    if (!year || !month || !day) return '—';
    if (parte === 'day') return String(day).padStart(2, '0');
    if (parte === 'year') return String(year);
    return ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][month - 1];
  }

  formatoFechaCorta(fecha: string | undefined) {
    if (!fecha || fecha === '—') return '—';
    const [year, month, day] = fecha.split('-').map(Number);
    if (!year || !month || !day) return fecha;
    const mes = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'][month - 1];
    return `${String(day).padStart(2, '0')} ${mes} ${year}`;
  }

  limpiar() {
    this.mascotaSel.set(null);
    this.resultado.set(null);
    this.matriz.set([]);
    this.controles.set([]);
    this.controlActivo.set(null);
    this.controlReprogramandoId.set(null);
    this.mostrarProgramar.set(false);
    this.searchQuery = '';
    this.mascotaModel = null;
    this.servicioId = null;
    this.tipoVacunaId = null;
    this.tipoDesparasitanteId = null;
    this.tipoProducto = '';
    this.tiposDesparasitante.set([]);
    this.fechaAplicacion = '';
    this.fechaProxima = '';
    this.limpiarAplicacion();
  }

  confirmarFechaProgramacion(fecha: Date | null) {
    this.progFechaCalendario = fecha;
    this.progFecha = this.aFechaIso(fecha);
  }

  onprogFechaChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.progFecha = value;
  }

  onFechaReprogramacionChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.fechaReprogramacion.set(value);
  }

  confirmarFechaReprogramacion(fecha: Date | null) {
    this.fechaReprogramacionCalendario = fecha;
    this.fechaReprogramacion.set(this.aFechaIso(fecha));
  }

  cerrarReprogramacion() {
    this.controlReprogramando.set(null);
    this.controlReprogramandoId.set(null);
  }

  etiquetaMascota(m: MascotaResponse) {
    return `${m.nombreCompleto} · ${m.especie}${m.razaNombre ? ' · ' + m.razaNombre : ''} · ${m.apoderadoNombreCompleto}`;
  }

  desdeFechaIso(fecha: string): Date | null {
    if (!fecha) return null;
    const [year, month, day] = fecha.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  }

  private aFechaIso(fecha: Date | null): string {
    if (!fecha) return '';
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }

  private fechaLocalLima(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }
}
