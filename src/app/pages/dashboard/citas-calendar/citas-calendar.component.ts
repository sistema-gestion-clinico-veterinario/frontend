
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, DayCellMountArg, EventContentArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Router } from '@angular/router';
import { CitaService } from '../../../core/services/cita.service';
import { CitaResponse } from '../../../models/response/cita-response';

/** Mismo color por estado que ya usa el mes de la Agenda, para que el widget del dashboard se
 * sienta como parte del mismo producto en vez de un calendario genérico aparte. */
const ACCENT: Record<string, string> = {
  PROGRAMADA: '#0066AA', PENDIENTE: '#d97706', CONFIRMADA: '#059669', REPROGRAMADA: '#7c3aed',
  SALA_DE_ESPERA: '#0891b2', EN_PROCESO: '#ea580c', COMPLETADA: '#16a34a', CANCELADA: '#dc2626',
  NO_ASISTIO: '#64748b'
};

export interface CitaDelDiaPopover {
  fecha: string;
  fechaLabel: string;
  top: number;
  left: number;
  citas: CitaResponse[];
}

/**
 * Calendario mensual de solo lectura para el dashboard: a diferencia de la Agenda completa
 * (edición, drag&drop, modales), aquí solo se necesita una vista rápida de qué días tienen
 * citas — mismo estilo visual que la Agenda (colores por estado), pero sin el resto de su estado.
 * Cada día con citas muestra puntos de color; al pasar el mouse o tocar el día aparece un
 * visualizador con el detalle de esas citas.
 */
@Component({
  selector: 'app-dashboard-citas-calendar',
  standalone: true,
  imports: [FullCalendarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './citas-calendar.component.html',
  styleUrl: './citas-calendar.component.scss'
})
export class DashboardCitasCalendarComponent {
  private readonly citaService = inject(CitaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  readonly companyId = input<number | undefined>(undefined);
  readonly cargando = signal(false);
  readonly titulo = signal('');
  readonly popover = signal<CitaDelDiaPopover | null>(null);

  private rangoActual: { desde: Date; hasta: Date } | null = null;
  private citasPorFecha = new Map<string, CitaResponse[]>();

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: false,
    height: 'auto',
    dayMaxEvents: false,
    eventDisplay: 'block',
    events: [],
    eventContent: info => this.renderEvent(info),
    dayCellDidMount: info => this.attachDayVisualizer(info),
    datesSet: info => {
      this.rangoActual = { desde: info.start, hasta: info.end };
      this.titulo.set(this.capitalizar(info.view.title));
      this.popover.set(null);
      this.cargarCitas(info.start, info.end);
    }
  };

  constructor() {
    // Vuelve a pedir el mismo rango de fechas visible cuando cambia la empresa activa (el
    // Administrador de Plataforma puede alternar de empresa sin que el calendario navegue de mes).
    effect(() => {
      this.companyId();
      if (this.rangoActual) {
        this.cargarCitas(this.rangoActual.desde, this.rangoActual.hasta);
      }
    });
    this.destroyRef.onDestroy(() => this.cancelarCierre());
  }

  irAnterior(): void {
    this.calendarComponent?.getApi().prev();
  }

  irSiguiente(): void {
    this.calendarComponent?.getApi().next();
  }

  irHoy(): void {
    this.calendarComponent?.getApi().today();
  }

  /** Cierre con un pequeño retraso: si el mouse va del día hacia el panel, cruza un hueco donde
   * no está ni sobre el día ni sobre el panel todavía — sin este margen, ese instante dispara el
   * mouseleave del día y el panel se cierra antes de que el usuario llegue a él. */
  private cierreTimeout: ReturnType<typeof setTimeout> | null = null;

  cerrarPopoverConRetraso(): void {
    this.cancelarCierre();
    this.cierreTimeout = setTimeout(() => this.popover.set(null), 250);
  }

  cancelarCierre(): void {
    if (this.cierreTimeout) {
      clearTimeout(this.cierreTimeout);
      this.cierreTimeout = null;
    }
  }

  cerrarPopover(): void {
    this.cancelarCierre();
    this.popover.set(null);
  }

  irAAgenda(): void {
    this.router.navigate(['/citas/agenda']);
  }

  colorEstado(estado: string): string {
    return ACCENT[estado] ?? '#64748b';
  }

  private cargarCitas(desde: Date, hasta: Date): void {
    const companyId = this.companyId();
    if (companyId == null) return;
    this.cargando.set(true);
    this.citaService
      .listar(companyId, undefined, undefined, undefined, 0, 500, this.toDateInput(desde), this.toDateInput(hasta))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          const citas = response.data.content ?? [];
          this.indexarPorFecha(citas);
          this.calendarOptions = { ...this.calendarOptions, events: this.toEvents(citas) };
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false)
      });
  }

  private indexarPorFecha(citas: CitaResponse[]): void {
    const index = new Map<string, CitaResponse[]>();
    for (const cita of citas) {
      const fecha = cita.fechaHoraInicio.slice(0, 10);
      const lista = index.get(fecha) ?? [];
      lista.push(cita);
      index.set(fecha, lista);
    }
    for (const lista of index.values()) {
      lista.sort((a, b) => a.fechaHoraInicio.localeCompare(b.fechaHoraInicio));
    }
    this.citasPorFecha = index;
  }

  /** Hover (escritorio) y click/toque (móvil) muestran el mismo visualizador de citas del día. */
  private attachDayVisualizer(info: DayCellMountArg): void {
    const fecha = this.toDateInput(info.date);
    const el = info.el as HTMLElement;

    const mostrar = () => {
      const citasDia = this.citasPorFecha.get(fecha);
      if (!citasDia?.length) return;
      this.cancelarCierre();
      const rect = el.getBoundingClientRect();
      const anchoPopover = 240;
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - anchoPopover - 8));
      this.popover.set({
        fecha,
        fechaLabel: this.capitalizar(info.date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })),
        top: rect.bottom + 6,
        left,
        citas: citasDia
      });
    };
    const ocultar = () => {
      if (this.popover()?.fecha === fecha) this.cerrarPopoverConRetraso();
    };

    if (this.citasPorFecha.get(fecha)?.length) {
      el.style.cursor = 'pointer';
    }
    el.addEventListener('mouseenter', mostrar);
    el.addEventListener('mouseleave', ocultar);
    el.addEventListener('click', () => {
      const actual = this.popover();
      if (actual?.fecha === fecha) this.popover.set(null);
      else mostrar();
    });
  }

  private toEvents(citas: CitaResponse[]): EventInput[] {
    return citas.map(cita => ({
      id: String(cita.id),
      title: cita.mascotaNombre,
      start: cita.fechaHoraInicio,
      end: cita.fechaHoraFin,
      extendedProps: { cita }
    }));
  }

  private renderEvent(info: EventContentArg) {
    const cita = info.event.extendedProps['cita'] as CitaResponse | undefined;
    const accent = ACCENT[cita?.estado ?? ''] ?? '#0066AA';
    return {
      html: `<span class="dashboard-day-dot" style="background:${accent}"></span>`
    };
  }

  private capitalizar(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
