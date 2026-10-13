import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApoderadoService } from '../../../../core/services/apoderado.service';
import { CancelacionDatosService } from '../../../../core/services/cancelacion-datos.service';
import { SolicitudCancelacion } from '../../../../models/privacy/cancelacion-datos.model';
import { ApoderadoListResponse } from '../../../../models/response/apoderado-list-response';

type Filtro = 'PENDIENTES' | 'RESUELTAS' | 'TODAS';
type Dialogo =
  | { tipo: 'ejecutar'; solicitud: SolicitudCancelacion }
  | { tipo: 'rechazar'; solicitud: SolicitudCancelacion }
  | { tipo: 'registrar' }
  | null;

@Component({
  selector: 'app-solicitudes-cancelacion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './solicitudes-cancelacion.component.html'
})
export class SolicitudesCancelacionComponent implements OnInit {
  private readonly servicio = inject(CancelacionDatosService);
  private readonly apoderados = inject(ApoderadoService);

  readonly solicitudes = signal<SolicitudCancelacion[]>([]);
  readonly filtro = signal<Filtro>('PENDIENTES');
  readonly cargando = signal(true);
  readonly trabajando = signal(false);
  readonly dialogo = signal<Dialogo>(null);
  readonly error = signal('');
  readonly aviso = signal('');

  readonly motivoRechazo = signal('');

  readonly busqueda = signal('');
  readonly resultados = signal<ApoderadoListResponse[]>([]);
  readonly buscando = signal(false);
  readonly clienteElegido = signal<ApoderadoListResponse | null>(null);
  readonly metodoVerificacion = signal('');
  readonly motivoRegistro = signal('');

  readonly pendientes = computed(() => this.solicitudes().filter(s => s.estado === 'PENDIENTE'));
  readonly visibles = computed(() => {
    switch (this.filtro()) {
      case 'PENDIENTES': return this.pendientes();
      case 'RESUELTAS': return this.solicitudes().filter(s => s.estado !== 'PENDIENTE');
      default: return this.solicitudes();
    }
  });
  readonly vencidas = computed(() => this.pendientes().filter(s => s.vencida).length);
  readonly rechazoValido = computed(() => this.motivoRechazo().trim().length >= 10);
  readonly registroValido = computed(() =>
    this.clienteElegido() !== null && this.metodoVerificacion().trim().length >= 5);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: ({ data }) => {
        this.solicitudes.set(data ?? []);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'No se pudieron cargar las solicitudes.');
      }
    });
  }

  seleccionarFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  abrirEjecutar(solicitud: SolicitudCancelacion): void {
    this.limpiarMensajes();
    this.dialogo.set({ tipo: 'ejecutar', solicitud });
  }

  abrirRechazar(solicitud: SolicitudCancelacion): void {
    this.limpiarMensajes();
    this.motivoRechazo.set('');
    this.dialogo.set({ tipo: 'rechazar', solicitud });
  }

  abrirRegistrar(): void {
    this.limpiarMensajes();
    this.busqueda.set('');
    this.resultados.set([]);
    this.clienteElegido.set(null);
    this.metodoVerificacion.set('');
    this.motivoRegistro.set('');
    this.dialogo.set({ tipo: 'registrar' });
  }

  cerrarDialogo(): void {
    if (this.trabajando()) return;
    this.dialogo.set(null);
    this.error.set('');
  }

  buscarClientes(): void {
    const texto = this.busqueda().trim();
    if (texto.length < 2) {
      this.resultados.set([]);
      return;
    }
    this.buscando.set(true);
    this.apoderados.listar(undefined, texto, undefined, 0, 6, true).subscribe({
      next: ({ data }) => {
        this.resultados.set(data?.content ?? []);
        this.buscando.set(false);
      },
      error: () => {
        this.resultados.set([]);
        this.buscando.set(false);
      }
    });
  }

  elegirCliente(cliente: ApoderadoListResponse): void {
    this.clienteElegido.set(cliente);
    this.resultados.set([]);
  }

  confirmarEjecutar(): void {
    const actual = this.dialogo();
    if (actual?.tipo !== 'ejecutar') return;
    this.resolver(this.servicio.ejecutar(actual.solicitud.id), 'Los datos personales fueron cancelados.');
  }

  confirmarRechazo(): void {
    const actual = this.dialogo();
    if (actual?.tipo !== 'rechazar' || !this.rechazoValido()) return;
    this.resolver(this.servicio.rechazar(actual.solicitud.id, this.motivoRechazo().trim()),
      'La solicitud fue rechazada y se avisó al titular.');
  }

  confirmarRegistro(): void {
    const cliente = this.clienteElegido();
    if (!cliente || !this.registroValido()) return;
    this.resolver(this.servicio.registrar({
      apoderadoId: cliente.id,
      metodoVerificacion: this.metodoVerificacion().trim(),
      motivo: this.motivoRegistro().trim() || null
    }), 'La solicitud quedó registrada. Revísala y resuélvela dentro del plazo.');
  }

  etiquetaEstado(solicitud: SolicitudCancelacion): string {
    switch (solicitud.estado) {
      case 'EJECUTADA': return 'Datos cancelados';
      case 'RECHAZADA': return 'Rechazada';
      default: return solicitud.vencida ? 'Plazo vencido' : 'En revisión';
    }
  }

  private resolver(llamada: ReturnType<CancelacionDatosService['ejecutar']>, mensajeExito: string): void {
    this.trabajando.set(true);
    this.error.set('');
    llamada.subscribe({
      next: () => {
        this.trabajando.set(false);
        this.dialogo.set(null);
        this.aviso.set(mensajeExito);
        this.cargar();
      },
      error: (err) => {
        this.trabajando.set(false);
        this.error.set(err.error?.message || 'No se pudo completar la acción.');
      }
    });
  }

  private limpiarMensajes(): void {
    this.error.set('');
    this.aviso.set('');
  }
}
