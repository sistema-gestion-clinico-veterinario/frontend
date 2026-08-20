import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
import { AutoCompleteModule, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { CartillaService } from '../../core/services/cartilla.service';
import { ControlPreventivoService } from '../../core/services/control-preventivo.service';
import { MascotaService } from '../../core/services/mascota.service';
import { ServicioService } from '../../core/services/servicio.service';
import { MascotaResponse } from '../../models/response/mascota-response';
import { ServicioResponse } from '../../models/response/servicio-response';
import { ControlPreventivoResponse, TipoControlPreventivo } from '../../models/response/control-preventivo-response';
import { AplicacionPreventiva, TipoVacuna, TipoDesparasitante, CartillaAplicacionResponse, IntervaloUnidad } from '../../models/cartilla.model';
import { AuthStore } from '../../store/auth.store';

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
    AutoCompleteModule,
    CardModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './cartilla.component.html',
  styleUrls: ['./cartilla.component.scss']
})
export class CartillaComponent implements OnInit {
  private readonly cartillaService         = inject(CartillaService);
  private readonly preventivoService       = inject(ControlPreventivoService);
  private readonly mascotaService          = inject(MascotaService);
  private readonly servicioService         = inject(ServicioService);
  private readonly msgService              = inject(MessageService);
  private readonly authStore               = inject(AuthStore);

  readonly modo = signal<'VACUNACION' | 'DESPARASITACION'>('VACUNACION');

  // Búsqueda / selección de mascota
  searchQuery        = '';
  resultados         = signal<MascotaResponse[]>([]);
  mascotaSugerencias = signal<MascotaResponse[]>([]);
  mascotaSel         = signal<MascotaResponse | null>(null);
  mascotaModel: MascotaResponse | null = null;
  buscando           = signal(false);

  // Alta rápida de mascota
  mostrarAlta   = signal(false);
  nuevoNombre   = '';
  nuevaEspecie  = '';
  nuevoSexo     = '';
  nuevaFechaNac = '';
  nuevoApoderadoId: number | null = null;

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
  readonly unidadesIntervalo = [
    { label: 'Días', value: 'DIAS' },
    { label: 'Semanas', value: 'SEMANAS' },
    { label: 'Meses', value: 'MESES' }
  ];
  readonly fechaHoyLima = this.fechaLocalLima();

  // Alta en catálogo (vacuna / desparasitante)
  dialogVisible = signal(false);
  dialogTipo: 'VACUNACION' | 'DESPARASITACION' = 'VACUNACION';
  nuevoCatNombre = '';
  nuevoCatPeriodicidad = 12;
  nuevoCatPrecio: number | null = null;

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

  // Programar control futuro
  mostrarProgramar = signal(false);
  progTipo         = 'VACUNACION' as TipoControlPreventivo;
  progTipoVacunaId = null as number | null;
  progNombreControl = '';
  progFecha        = '';

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
      .filter((c) => c.tipo === this.modo() && !['APLICADO', 'CANCELADO'].includes(c.estado))
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
    this.cargarServiciosPreventivos();
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

  onFilterMascota(event: AutoCompleteCompleteEvent) {
    const q = event.query?.trim();
    if (!q) { this.mascotaSugerencias.set([]); return; }
    this.mascotaService.listar(this.companyId, q, undefined, 0, 20, true, true).subscribe({
      next: (res) => {
        const lista = (res.data?.content ?? []);
        const yaSeleccionado = this.mascotaSel();
        this.mascotaSugerencias.set(yaSeleccionado ? [yaSeleccionado, ...lista.filter(m => m.id !== yaSeleccionado.id)] : lista);
      },
      error: () => this.mascotaSugerencias.set([])
    });
  }

  onAutocompleteSelect(value: MascotaResponse) {
    this.mascotaSel.set(value);
    this.mascotaModel = value;
    this.searchQuery = value.nombreCompleto;
    this.resultados.set([]);
    this.cargarDatosMascota(value.id);
  }

  seleccionarMascota(m: MascotaResponse) {
    this.mascotaSel.set(m);
    this.resultados.set([]);
    this.searchQuery = m.nombreCompleto;
    this.cargarDatosMascota(m.id);
  }

  private cargarDatosMascota(petId: number) {
    this.cargarTiposVacuna(petId);
    this.cargarTiposDesparasitante(petId);
    this.cargarControles(petId);
    this.cargarMatriz(petId);
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
    if (modo === 'VACUNACION') this.cargarTiposVacuna(m.id);
    else this.cargarTiposDesparasitante(m.id);
  }

  registrarNuevaMascota() {
    if (!this.nuevoNombre?.trim() || !this.nuevaEspecie || !this.nuevoApoderadoId) {
      this.msgService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Nombre, especie y apoderado son obligatorios' });
      return;
    }
    this.mascotaService.crear({
      nombreCompleto: this.nuevoNombre.trim(),
      especie: this.nuevaEspecie,
      sexo: this.nuevoSexo || 'MACHO',
      fechaNacimiento: this.nuevaFechaNac || this.fechaLocalLima(),
      apoderadoId: this.nuevoApoderadoId,
      razaId: 0
    }).subscribe({
      next: (res) => {
        this.mascotaSel.set(res.data);
        this.mostrarAlta.set(false);
        this.cargarDatosMascota(res.data.id);
        this.msgService.add({ severity: 'success', summary: 'Mascota registrada', detail: res.data.nombreCompleto });
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar la mascota' })
    });
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
    if (control.tipo === 'DESPARASITACION') this.cargarTiposDesparasitante(this.mascotaSel()!.id);
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
  }

  iniciarReprogramacion(control: ControlPreventivoResponse) {
    this.controlReprogramandoId.set(control.id);
    this.fechaReprogramacion.set(control.fechaRecomendada);
  }

  guardarReprogramacion(control: ControlPreventivoResponse) {
    const fecha = this.fechaReprogramacion();
    if (!fecha) return;
    this.guardando.set(true);
    this.preventivoService.reprogramar(control.id, fecha).subscribe({
      next: () => {
        this.controlReprogramandoId.set(null);
        this.msgService.add({ severity: 'success', summary: 'Control reprogramado', detail: 'Fecha recomendada actualizada' });
        this.recargarMascota();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo reprogramar el control' }),
      complete: () => this.guardando.set(false)
    });
  }

  cancelarControl(control: ControlPreventivoResponse) {
    this.guardando.set(true);
    this.preventivoService.cancelar(control.id).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Control cancelado', detail: control.nombreControl });
        this.recargarMascota();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo cancelar el control' }),
      complete: () => this.guardando.set(false)
    });
  }

  abrirProgramar() {
    this.mostrarProgramar.set(!this.mostrarProgramar());
    this.progTipo = this.modo();
    this.progFecha = this.fechaLocalLima();
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
    if (!this.servicioId) { this.msgService.add({ severity: 'warn', summary: 'Falta servicio', detail: 'Seleccione el servicio preventivo' }); return; }
    if (this.modo() === 'VACUNACION' && !this.tipoVacunaId) { this.msgService.add({ severity: 'warn', summary: 'Falta vacuna', detail: 'Seleccione la vacuna' }); return; }
    if (this.modo() === 'DESPARASITACION' && !this.tipoDesparasitanteId) { this.msgService.add({ severity: 'warn', summary: 'Falta desparasitante', detail: 'Seleccione el desparasitante' }); return; }
    if (!this.fechaAplicacion) { this.msgService.add({ severity: 'warn', summary: 'Falta fecha', detail: 'Indique la fecha de aplicación' }); return; }
    if (!this.fechaProxima && (!this.intervaloCantidad || !this.intervaloUnidad)) {
      this.msgService.add({ severity: 'warn', summary: 'Falta próximo control', detail: 'Indique una próxima fecha o un intervalo' }); return;
    }
    if (this.dosis != null && !this.unidadDosis.trim()) {
      this.msgService.add({ severity: 'warn', summary: 'Falta unidad', detail: 'Indique la unidad de la dosis' }); return;
    }

    const req = {
      mascotaId: m.id,
      controlPreventivoId: this.controlActivo()?.id,
      servicioId: this.servicioId,
      fechaAplicacion: this.fechaAplicacion,
      intervaloCantidad: this.fechaProxima ? undefined : this.intervaloCantidad,
      intervaloUnidad: this.fechaProxima ? undefined : this.intervaloUnidad,
      fechaProxima: this.fechaProxima || undefined,
      lote: this.lote.trim() || undefined,
      fechaVencimientoProducto: this.fechaVencimientoProducto || undefined,
      dosis: this.dosis ?? undefined,
      unidadDosis: this.unidadDosis.trim() || undefined,
      viaAdministracion: this.viaAdministracion.trim() || undefined,
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
        this.msgService.add({ severity: 'success', summary: 'Registrado', detail: `Cobro generado: ${res.data.codigoCobro} (S/ ${res.data.total})` });
        this.recargarMascota();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar' }),
      complete: () => this.guardando.set(false)
    });
  }

  private recargarMascota() {
    const m = this.mascotaSel();
    if (!m) return;
    this.cargarControles(m.id);
    this.cargarMatriz(m.id);
    if (this.modo() === 'VACUNACION') this.cargarTiposVacuna(m.id);
    else this.cargarTiposDesparasitante(m.id);
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

  crearVacuna() {
    const m = this.mascotaSel();
    if (!m) { this.msgService.add({ severity: 'warn', summary: 'Falta mascota', detail: 'Seleccione la mascota' }); return; }
    if (!this.nuevoCatNombre?.trim() || this.nuevoCatPrecio == null) {
      this.msgService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Nombre y precio son obligatorios' }); return;
    }
    this.cartillaService.crearTipoVacuna({
      nombre: this.nuevoCatNombre.trim(),
      especie: m.especie,
      periodicidadMesesSugerida: this.nuevoCatPeriodicidad || undefined,
      precio: this.nuevoCatPrecio
    }).subscribe({
      next: (res) => {
        this.tiposVacuna.update(items => [...items.filter(item => item.id !== res.data.id), res.data]
          .sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.tipoVacunaId = res.data.id;
        this.actualizarIntervaloSugerido(res.data.id);
        this.msgService.add({ severity: 'success', summary: 'Vacuna agregada al catálogo', detail: `${res.data.nombre} quedó seleccionada para esta aplicación` });
        this.dialogVisible.set(false);
        this.limpiarCatalogoForm();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear la vacuna' })
    });
  }

  crearDesparasitante() {
    const m = this.mascotaSel();
    if (!m) { this.msgService.add({ severity: 'warn', summary: 'Falta mascota', detail: 'Seleccione la mascota' }); return; }
    if (!this.nuevoCatNombre?.trim() || this.nuevoCatPrecio == null) {
      this.msgService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Nombre y precio son obligatorios' }); return;
    }
    this.cartillaService.crearTipoDesparasitante({
      nombre: this.nuevoCatNombre.trim(),
      especie: m.especie,
      periodicidadMesesSugerida: this.nuevoCatPeriodicidad || undefined,
      precio: this.nuevoCatPrecio
    }).subscribe({
      next: (res) => {
        this.tiposDesparasitante.update(items => [...items.filter(item => item.id !== res.data.id), res.data]
          .sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.tipoDesparasitanteId = res.data.id;
        this.actualizarIntervaloSugerido(res.data.id);
        this.msgService.add({ severity: 'success', summary: 'Desparasitante agregado al catálogo', detail: `${res.data.nombre} quedó seleccionado para esta aplicación` });
        this.dialogVisible.set(false);
        this.limpiarCatalogoForm();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear el desparasitante' })
    });
  }

  abrirNuevaCatalogo() {
    this.limpiarCatalogoForm();
    this.dialogTipo = this.modo();
    this.dialogVisible.set(true);
  }

  private limpiarCatalogoForm() {
    this.nuevoCatNombre = '';
    this.nuevoCatPeriodicidad = 12;
    this.nuevoCatPrecio = null;
  }

  private cargarMatriz(petId: number) {
    this.cartillaService.obtenerMatriz(petId).subscribe({
      next: (res) => this.matriz.set(res.data ?? []),
      error: () => this.matriz.set([])
    });
  }

  claseEstadoPreventivo(estado: string) {
    if (estado === 'ATRASADO') return 'bg-rose-50 text-rose-700';
    if (estado === 'PENDIENTE' || estado === 'PROXIMO') return 'bg-amber-50 text-amber-700';
    if (estado === 'SUSPENDIDO_POR_CITA') return 'bg-sky-50 text-sky-700';
    return 'bg-emerald-50 text-emerald-700';
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
    this.dialogVisible.set(false);
    this.limpiarCatalogoForm();
    this.fechaAplicacion = '';
    this.fechaProxima = '';
    this.limpiarAplicacion();
  }

  private fechaLocalLima(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? '';
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }
}
