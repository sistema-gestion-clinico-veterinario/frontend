import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CartillaService } from '../../core/services/cartilla.service';
import { ControlPreventivoService } from '../../core/services/control-preventivo.service';
import { MascotaService } from '../../core/services/mascota.service';
import { ServicioService } from '../../core/services/servicio.service';
import { MascotaResponse } from '../../models/response/mascota-response';
import { ServicioResponse } from '../../models/response/servicio-response';
import { ControlPreventivoResponse, TipoControlPreventivo } from '../../models/response/control-preventivo-response';
import { AplicacionPreventiva, TipoVacuna, CartillaAplicacionResponse } from '../../models/cartilla.model';

@Component({
  selector: 'app-cartilla',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule],
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

  readonly modo = signal<'VACUNACION' | 'DESPARASITACION'>('VACUNACION');

  // Búsqueda / selección de mascota
  searchQuery   = '';
  resultados    = signal<MascotaResponse[]>([]);
  mascotaSel    = signal<MascotaResponse | null>(null);
  buscando      = signal(false);

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
  tipoProducto = '';
  tiposVacuna = signal<TipoVacuna[]>([]);
  fechaAplicacion = '';
  periodicidadMeses = 3;
  fechaProxima = '';

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
    [...this.controles()].sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada))
  );

  ngOnInit() {
    this.cargarServiciosPreventivos();
  }

  private cargarServiciosPreventivos() {
    this.servicioService.listarDisponibles().subscribe({
      next: (res) =>
        this.serviciosPreventivos.set(
          (res.data ?? []).filter((s) => s.tipoControlPreventivo && s.tipoControlPreventivo !== 'NO_APLICA')
        ),
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los servicios preventivos' })
    });
  }

  buscar() {
    const q = this.searchQuery?.trim();
    if (!q) return;
    this.buscando.set(true);
    this.mascotaService.listar(undefined, q, undefined, 0, 20, true, true).subscribe({
      next: (res) => this.resultados.set((res.data?.content ?? [])),
      error: () => this.resultados.set([]),
      complete: () => this.buscando.set(false)
    });
  }

  seleccionarMascota(m: MascotaResponse) {
    this.mascotaSel.set(m);
    this.resultados.set([]);
    this.searchQuery = m.nombreCompleto;
    this.cargarDatosMascota(m.id);
  }

  private cargarDatosMascota(petId: number) {
    this.cargarTiposVacuna(petId);
    this.cargarControles(petId);
    this.cargarMatriz(petId);
  }

  private cargarTiposVacuna(petId: number) {
    this.preventivoService.listarTiposVacuna(petId).subscribe({
      next: (res) => this.tiposVacuna.set(res.data ?? []),
      error: () => this.msgService.add({ severity: 'warn', summary: 'Aviso', detail: 'No se pudieron cargar los tipos de vacuna' })
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
    const m = this.mascotaSel();
    if (modo === 'VACUNACION' && m) this.cargarTiposVacuna(m.id);
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
      fechaNacimiento: this.nuevaFechaNac || new Date().toISOString().slice(0, 10),
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
      this.tipoProducto = '';
      this.periodicidadMeses = control.tipoVacunaId
        ? (this.tiposVacuna().find(v => v.id === control.tipoVacunaId)?.periodicidadMesesSugerida ?? this.periodicidadMeses)
        : this.periodicidadMeses;
    } else {
      this.tipoProducto = control.nombreControl || '';
      this.tipoVacunaId = null;
    }
    this.fechaAplicacion = new Date().toISOString().slice(0, 10);
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
    this.progFecha = new Date().toISOString().slice(0, 10);
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
    if (this.modo() === 'DESPARASITACION' && !this.tipoProducto?.trim()) { this.msgService.add({ severity: 'warn', summary: 'Falta producto', detail: 'Indique el producto' }); return; }
    if (!this.fechaAplicacion) { this.msgService.add({ severity: 'warn', summary: 'Falta fecha', detail: 'Indique la fecha de aplicación' }); return; }

    const req = {
      mascotaId: m.id,
      servicioId: this.servicioId,
      fechaAplicacion: this.fechaAplicacion,
      periodicidadMeses: this.periodicidadMeses,
      fechaProxima: this.fechaProxima || undefined,
      ...(this.modo() === 'VACUNACION' ? { tipoVacunaId: this.tipoVacunaId! } : { producto: this.tipoProducto.trim() })
    };

    this.guardando.set(true);
    const call = this.modo() === 'VACUNACION'
      ? this.cartillaService.registrarVacunacion(req)
      : this.cartillaService.registrarDesparasitacion(req);

    call.subscribe({
      next: (res) => {
        this.resultado.set(res.data);
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
    this.servicioId = null;
    this.tipoVacunaId = null;
    this.tipoProducto = '';
    this.fechaAplicacion = '';
    this.fechaProxima = '';
  }
}