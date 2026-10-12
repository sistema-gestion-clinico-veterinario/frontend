import { Component, ViewChild, computed, input } from '@angular/core';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';

/**
 * Adaptador aislado para FullCalendar.
 *
 * Se mantiene fuera de AgendaComponent para que Angular pueda generar un
 * chunk diferido: la vista lista y los dispositivos pequenos no descargan la
 * libreria completa del calendario.
 */
@Component({
  selector: 'app-agenda-full-calendar',
  standalone: true,
  imports: [FullCalendarModule],
  template: '<full-calendar #calendar [options]="resolvedOptions()" />'
})
export class AgendaFullCalendarComponent {
  readonly options = input.required<CalendarOptions>();

  @ViewChild('calendar') private calendar?: FullCalendarComponent;

  readonly resolvedOptions = computed<CalendarOptions>(() => ({
    ...this.options(),
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin]
  }));

  changeView(viewName: string, date: Date): void {
    this.calendar?.getApi().changeView(viewName, date);
  }

  replaceEvents(date: Date, events: EventInput[]): void {
    const api = this.calendar?.getApi();
    if (!api) return;

    api.gotoDate(date);
    api.removeAllEvents();
    api.addEventSource(events);
  }
}
