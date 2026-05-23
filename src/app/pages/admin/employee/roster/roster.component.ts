import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnDestroy, computed } from '@angular/core';
import ExcelJS from 'exceljs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EmpleadoService } from '../../../../core/services/empleado.service';
import { EmpleadoListResponse } from '../../../../models/response/empleado-list-response';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { AuthStore } from '../../../../store/auth.store';

import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FormsModule } from '@angular/forms';
import { ScheduleFormComponent } from './components/schedule-form/schedule-form.component';

@Component({
  selector: 'app-roster',
  standalone: true,
  imports: [CommonModule, RouterModule, DropdownModule, ButtonModule, ToastModule, ConfirmDialogModule, FormsModule, ScheduleFormComponent],
  providers: [MessageService, ConfirmationService],
  templateUrl: './roster.component.html',
  styleUrl: './roster.component.scss'
})
export class RosterComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('timelineScroll') timelineScroll?: ElementRef;
  private shouldScrollToCurrentHour = false;
  private timeUpdateTimer?: any;
  private readonly empleadoService = inject(EmpleadoService);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  employees           = signal<{label: string, value: number}[]>([]);
  selectedEmployeeId  = signal<number | null>(null);
  showSidebar         = signal<boolean>(false);
  shifts              = signal<any[]>([]);
  dayViewHours        = signal<any[]>([]);
  viewMode            = signal<'day' | 'week' | 'month'>('month');
  currentDate         = signal<Date>(new Date());
  calendarDays        = signal<any[]>([]);
  loading             = signal<boolean>(false);
  currentTimeOffset   = signal<number>(0);
  selectedShift       = signal<any>(null);
  displayShiftDetail  = signal<boolean>(false);
  shiftForDetail      = signal<any>(null);
  showCloneDayModal   = signal<boolean>(false);
  cloneTargetDate     = signal<string>('');
  showCleanModal      = signal<boolean>(false);
  cleanStartDate      = signal<string>('');
  cleanEndDate        = signal<string>('');
  selectedCleanDays   = signal<Set<string>>(new Set());

  readonly dayOfWeekOptions = [
    { label: 'L', value: 'LUNES' },
    { label: 'M', value: 'MARTES' },
    { label: 'X', value: 'MIERCOLES' },
    { label: 'J', value: 'JUEVES' },
    { label: 'V', value: 'VIERNES' },
    { label: 'S', value: 'SABADO' },
    { label: 'D', value: 'DOMINGO' }
  ];

  canManage = computed(() => {
    const roles = this.authStore.roles() || [];
    return this.authStore.hasAccess('VISTA_HORARIOS', 'modificar') ||
           roles.includes('ROLE_SUPER_ADMIN') ||
           roles.includes('ROLE_ADMIN');
  });

  selectedEmployeeName = computed(() => {
    const id = this.selectedEmployeeId();
    const list = this.employees();
    return list.find(e => e.value === id)?.label || '';
  });

  selectedEmployeeCargo = computed(() => {
    const id = this.selectedEmployeeId();
    const list = this.employees();
    return (list.find(e => e.value === id) as any)?.cargo || 'Personal';
  });

  currentDateFormatted = computed(() => {
    return new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  });

  currentDateIso = computed(() => {
    const d = this.currentDate();
    return d.toISOString().split('T')[0];
  });

  printableWeeks = computed(() => {
    const allShifts = this.shifts();
    const datedShifts = allShifts.filter((s: any) => s.fecha);
    const baseShifts  = allShifts.filter((s: any) => !s.fecha);

    const weeksMap = new Map<string, any[]>();
    datedShifts.forEach((s: any) => {
      const d    = new Date(s.fecha + 'T00:00:00');
      const day  = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday    = new Date(d.setDate(diff));
      const mondayStr = monday.toISOString().split('T')[0];
      if (!weeksMap.has(mondayStr)) weeksMap.set(mondayStr, []);
      weeksMap.get(mondayStr)?.push(s);
    });

    const sortedWeekKeys = Array.from(weeksMap.keys()).sort();
    const list: any[]    = [];
    const dayNames       = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

    if (baseShifts.length > 0) {
      const days: any[] = [];
      dayNames.forEach(name => {
        const dayShifts = baseShifts.filter((s: any) => s.diaSemana === name);
        days.push({
          name,
          shifts: dayShifts.map((s: any) => ({
            timeRange: `${s.horaInicio?.substring(0, 5)} - ${s.horaFin?.substring(0, 5)}`,
            duration:  this.calculateTotalHours([s])
          }))
        });
      });
      list.push({ isBase: true, title: 'Base Semanal', subtitle: 'Plantilla Fija', days });
    }

    sortedWeekKeys.forEach(mondayStr => {
      const mondayDate = new Date(mondayStr + 'T00:00:00');
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(mondayDate.getDate() + 6);

      const weekShifts = weeksMap.get(mondayStr) || [];
      const days: any[] = [];

      for (let i = 0; i < 7; i++) {
        const currentDay    = new Date(mondayDate);
        currentDay.setDate(mondayDate.getDate() + i);
        const currentDayStr = currentDay.toISOString().split('T')[0];
        const dayShifts     = weekShifts.filter((s: any) => s.fecha === currentDayStr);
        days.push({
          name: dayNames[i],
          shifts: dayShifts.map((s: any) => ({
            timeRange: `${s.horaInicio?.substring(0, 5)} - ${s.horaFin?.substring(0, 5)}`,
            duration:  this.calculateTotalHours([s])
          }))
        });
      }

      list.push({
        isBase:   false,
        title:    'Semana',
        subtitle: `${mondayDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} al ${sundayDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}`,
        days
      });
    });

    return list;
  });

  totalWeeklyHours = computed(() => {
    const shifts  = this.shifts();
    const mode    = this.viewMode();
    const current = this.currentDate();

    if (mode === 'week') {
      const startOfWeek = new Date(current);
      startOfWeek.setDate(current.getDate() - current.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr   = endOfWeek.toISOString().split('T')[0];
      return this.calculateTotalHours(shifts.filter(s => s.fecha >= startStr && s.fecha <= endStr));
    }

    if (mode === 'day') {
      const dateStr = current.toISOString().split('T')[0];
      return this.calculateTotalHours(shifts.filter(s => s.fecha === dateStr));
    }

    return 0;
  });

  totalMonthlyHours = computed(() => {
    const shifts  = this.shifts();
    const current = this.currentDate();
    const year    = current.getFullYear();
    const month   = current.getMonth();
    const startStr = new Date(year, month, 1).toISOString().split('T')[0];
    const endStr   = new Date(year, month + 1, 0).toISOString().split('T')[0];
    return this.calculateTotalHours(shifts.filter(s => s.fecha >= startStr && s.fecha <= endStr));
  });

  totalShiftsHours = computed(() => this.calculateTotalHours(this.shifts()));

  scheduleRange = computed(() => {
    const shifts = this.shifts();
    if (shifts.length === 0) return null;
    const dates = shifts.map(s => s.fecha).filter(f => !!f).sort();
    if (dates.length === 0) return null;
    return { start: dates[0], end: dates[dates.length - 1] };
  });

  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  readonly viewOptions = [
    { label: 'Día',    value: 'day'   },
    { label: 'Semana', value: 'week'  },
    { label: 'Mes',    value: 'month' }
  ];

  // ── Constructor vacío — sin effect ───────────────────────────────────────
  constructor() {}

  ngOnInit() {
    // Carga inicial de empleados una sola vez
    const companyId = this.authStore.selectedEnterprise()?.establishmentId
                   ?? this.authStore.companyId();
    if (companyId) {
      this.loadEmployeeList(companyId);
    }

    // Timer para la línea de hora actual en vista día
    this.timeUpdateTimer = setInterval(() => {
      if (this.viewMode() === 'day') {
        this.updateTimeOffset();
      }
    }, 60000);
  }

  ngOnDestroy() {
    if (this.timeUpdateTimer) {
      clearInterval(this.timeUpdateTimer);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToCurrentHour && this.timelineScroll) {
      this.scrollToCurrentHour();
      this.shouldScrollToCurrentHour = false;
    }
  }

  // Llamar este método desde navbar cuando superadmin cambia de empresa
  reloadForCompany(companyId: number) {
    this.selectedEmployeeId.set(null);
    this.shifts.set([]);
    this.calendarDays.set([]);
    this.loadEmployeeList(companyId);
  }

  private scrollToCurrentHour() {
    if (!this.timelineScroll) return;
    const currentHour  = new Date().getHours();
    const scrollAmount = Math.max(0, (currentHour * 45) - 45);
    this.timelineScroll.nativeElement.scrollTop = scrollAmount;
  }

  private updateTimeOffset() {
    const now     = new Date();
    const isToday = this.isToday(this.currentDate());
    if (!isToday) {
      this.currentTimeOffset.set(-1);
      return;
    }
    const h = now.getHours();
    const m = now.getMinutes();
    this.currentTimeOffset.set((h * 45) + (m / 60 * 45));
  }

  private calculateTotalHours(shifts: any[]): number {
    let total = 0;
    shifts.forEach(s => {
      if (s.horaInicio && s.horaFin) {
        const [h1, m1] = s.horaInicio.split(':').map(Number);
        const [h2, m2] = s.horaFin.split(':').map(Number);
        const diff = (h2 + m2 / 60) - (h1 + m1 / 60);
        if (diff > 0) total += diff;
      }
    });
    return Math.round(total * 100) / 100;
  }

  loadEmployeeList(companyId: number) {
    this.empleadoService.listar(companyId, undefined, 0, 1000).subscribe({
      next: (res) => {
        const list = res.data.content.map(e => ({
          label: `${e.nombre} ${e.apellido}`,
          value: e.id,
          cargo: e.tiposEmpleado && e.tiposEmpleado.length > 0 ? e.tiposEmpleado[0] : 'Personal'
        }));
        this.employees.set(list);
      }
    });
  }

  loadSchedule(id: number) {
    this.loading.set(true);
    this.empleadoService.getHorario(id).subscribe({
      next: (res) => {
        const sortedShifts = (res.data || []).sort((a, b) => {
          if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
          if (a.fecha) return 1;
          if (b.fecha) return -1;
          return 0;
        });
        this.shifts.set(sortedShifts);
        this.generateCalendar();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // Llamado explícitamente al seleccionar empleado desde el template
  onEmployeeChange(value: string) {
    if (value === 'null') {
      this.selectedEmployeeId.set(null);
      this.calendarDays.set([]);
      this.shifts.set([]);
    } else {
      const id = Number(value);
      this.selectedEmployeeId.set(id);
      this.loadSchedule(id);
      if (this.viewMode() === 'day') {
        this.shouldScrollToCurrentHour = true;
        this.updateTimeOffset();
      }
    }
  }

  generateCalendar() {
    const days: any[]       = [];
    const date              = new Date(this.currentDate());
    const dayOfWeekMap      = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

    if (this.viewMode() === 'month') {
      const start        = new Date(date.getFullYear(), date.getMonth(), 1);
      const end          = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const startDay     = start.getDay();
      const prevMonthEnd = new Date(date.getFullYear(), date.getMonth(), 0).getDate();

      for (let i = startDay - 1; i >= 0; i--) {
        days.push({ day: prevMonthEnd - i, otherMonth: true });
      }

      for (let i = 1; i <= end.getDate(); i++) {
        const current   = new Date(date.getFullYear(), date.getMonth(), i);
        const dateStr   = current.toISOString().split('T')[0];
        const dayOfWeek = dayOfWeekMap[current.getDay()];
        const dayShifts = this.shifts().filter((s: any) =>
          s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
        );
        days.push({ day: i, date: current, isToday: this.isToday(current), shifts: dayShifts });
      }
    } else if (this.viewMode() === 'week') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());

      for (let i = 0; i < 7; i++) {
        const current   = new Date(startOfWeek);
        current.setDate(startOfWeek.getDate() + i);
        const dateStr   = current.toISOString().split('T')[0];
        const dayOfWeek = dayOfWeekMap[current.getDay()];
        const dayShifts = this.shifts().filter((s: any) =>
          s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
        );
        days.push({ day: current.getDate(), date: current, isToday: this.isToday(current), shifts: dayShifts });
      }
    } else {
      const dateStr   = date.toISOString().split('T')[0];
      const dayOfWeek = dayOfWeekMap[date.getDay()];
      const dayShifts = this.shifts().filter((s: any) =>
        s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
      );
      days.push({ day: date.getDate(), date, isToday: this.isToday(date), shifts: dayShifts });
    }

    this.calendarDays.set(days);

    if (this.viewMode() === 'day') {
      this.generateDayHourView();
    }
  }

  generateDayHourView() {
    const date         = new Date(this.currentDate());
    const dateStr      = date.toISOString().split('T')[0];
    const dayOfWeekMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const dayOfWeek    = dayOfWeekMap[date.getDay()];
    const dayShifts    = this.shifts().filter((s: any) =>
      s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
    );

    const hours: any[] = [];
    for (let h = 0; h <= 23; h++) {
      const timeStr     = `${h.toString().padStart(2, '0')}:00`;
      const nextTimeStr = `${(h + 1).toString().padStart(2, '0')}:00`;
      const coveringShift = dayShifts.find((s: any) => {
        const start = s.horaInicio.substring(0, 5);
        const end   = s.horaFin.substring(0, 5);
        return timeStr >= start && timeStr < end;
      });
      const isShiftStart = dayShifts.some((s: any) => s.horaInicio.substring(0, 5) === timeStr);
      const isShiftEnd   = dayShifts.some((s: any) => s.horaFin.substring(0, 5) === nextTimeStr);
      hours.push({ hour: h, label: timeStr, isWorking: !!coveringShift, isShiftStart, isShiftEnd, shift: coveringShift || null });
    }
    this.dayViewHours.set(hours);
  }

  isToday(d: Date): boolean {
    return d.toDateString() === new Date().toDateString();
  }

  get hasWorkingHours(): boolean {
    return this.dayViewHours().some(h => h.isWorking);
  }

  get dayViewDayName(): string {
    return this.currentDate().toLocaleDateString('es-PE', { weekday: 'long' });
  }

  get dayViewFullDate(): string {
    return this.currentDate().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  verDetalle(shift: any) {
    this.shiftForDetail.set(shift);
    this.displayShiftDetail.set(true);
  }

  calcularDuracion(horaInicio: string, horaFin: string): string {
    if (!horaInicio || !horaFin) return '–';
    const [h1, m1]  = horaInicio.split(':').map(Number);
    const [h2, m2]  = horaFin.split(':').map(Number);
    const totalMin  = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMin <= 0) return '–';
    const horas = Math.floor(totalMin / 60);
    const mins  = totalMin % 60;
    return horas > 0 ? `${horas}h ${mins > 0 ? mins + 'min' : ''}`.trim() : `${mins}min`;
  }

  formatShiftDate(fecha: string): string {
    if (!fecha) return '–';
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  editShift(shift: any) {
    if (!this.canManage()) return;
    this.selectedShift.set(shift);
    this.showSidebar.set(true);
  }

  openAddForm(date?: string) {
    if (!this.selectedEmployeeId()) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Selecciona un empleado primero' });
      return;
    }
    this.selectedShift.set(date ? { fecha: date } : null);
    this.showSidebar.set(true);
  }

  onDayClick(item: any) {
    if (!this.canManage() || item.otherMonth) return;
    const dateStr = item.date.toISOString().split('T')[0];
    this.openAddForm(dateStr);
  }

  // Cambio de vista (día/semana/mes) — regenera calendario sin nueva petición HTTP
  setViewMode(mode: 'day' | 'week' | 'month') {
    this.viewMode.set(mode);
    if (this.selectedEmployeeId()) {
      this.generateCalendar();
      if (mode === 'day') {
        this.shouldScrollToCurrentHour = true;
        this.updateTimeOffset();
      }
    }
  }

  prev() {
    const d    = new Date(this.currentDate());
    const mode = this.viewMode();
    if (mode === 'month')      d.setMonth(d.getMonth() - 1);
    else if (mode === 'week')  d.setDate(d.getDate() - 7);
    else                       d.setDate(d.getDate() - 1);
    this.currentDate.set(d);
    if (this.selectedEmployeeId()) this.loadSchedule(this.selectedEmployeeId()!);
  }

  next() {
    const d    = new Date(this.currentDate());
    const mode = this.viewMode();
    if (mode === 'month')      d.setMonth(d.getMonth() + 1);
    else if (mode === 'week')  d.setDate(d.getDate() + 7);
    else                       d.setDate(d.getDate() + 1);
    this.currentDate.set(d);
    if (this.selectedEmployeeId()) this.loadSchedule(this.selectedEmployeeId()!);
  }

  get currentLabel(): string {
    const d    = this.currentDate();
    const mode = this.viewMode();
    if (mode === 'month') return `${this.monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (mode === 'week') {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} ${this.monthNames[start.getMonth()].substring(0, 3)} - ${end.getDate()} ${this.monthNames[end.getMonth()].substring(0, 3)}`;
    }
    return `${d.getDate()} ${this.monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  deleteShift(shift: any) {
    const detail = `del día ${shift.fecha} a las ${shift.horaInicio}`;
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar permanentemente el turno ${detail}?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.empleadoService.deleteHorario(shift.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Turno eliminado correctamente' });
            if (this.selectedEmployeeId()) this.loadSchedule(this.selectedEmployeeId()!);
          }
        });
      }
    });
  }

  copyLastWeek() {
    const id = this.selectedEmployeeId();
    if (!id) return;

    const current         = new Date(this.currentDate());
    const startOfThisWeek = new Date(current);
    startOfThisWeek.setDate(current.getDate() - current.getDay());

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);

    const startStr       = startOfLastWeek.toISOString().split('T')[0];
    const endStr         = endOfLastWeek.toISOString().split('T')[0];
    const lastWeekShifts = this.shifts().filter(s => s.fecha >= startStr && s.fecha <= endStr);

    if (lastWeekShifts.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'No hay turnos en la semana anterior para copiar.' });
      return;
    }

    this.confirmationService.confirm({
      message: `¿Deseas copiar los ${lastWeekShifts.length} turnos de la semana pasada a la semana actual? Se sobrescribirán los existentes.`,
      header: 'Automatizar Horario',
      icon: 'pi pi-copy',
      acceptLabel: 'Sí, copiar',
      rejectLabel: 'Cancelar',
      accept: () => {
        const sourceStr = startOfLastWeek.toISOString().split('T')[0];
        const targetStr = startOfThisWeek.toISOString().split('T')[0];
        this.loading.set(true);
        this.empleadoService.cloneWeek(id, sourceStr, targetStr).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Horario clonado correctamente desde el servidor' });
            this.loadSchedule(id);
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al clonar' });
            this.loading.set(false);
          }
        });
      }
    });
  }

  openCloneDayDialog() {
    const current   = new Date(this.currentDate());
    const tomorrow  = new Date(current);
    tomorrow.setDate(current.getDate() + 1);
    this.cloneTargetDate.set(tomorrow.toISOString().split('T')[0]);
    this.showCloneDayModal.set(true);
  }

  closeCloneDayDialog() {
    this.showCloneDayModal.set(false);
  }

  confirmCloneDay() {
    const id        = this.selectedEmployeeId();
    if (!id) return;

    const sourceStr = this.currentDate().toISOString().split('T')[0];
    const targetStr = this.cloneTargetDate();

    if (!targetStr) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Selecciona una fecha de destino.' });
      return;
    }
    if (sourceStr === targetStr) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'La fecha de destino debe ser diferente al día de origen.' });
      return;
    }

    const dayOfWeekMap  = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const dayOfWeek     = dayOfWeekMap[this.currentDate().getDay()];
    const shiftsForToday = this.shifts().filter(s => s.fecha === sourceStr || (!s.fecha && s.diaSemana === dayOfWeek));

    if (shiftsForToday.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'No hay turnos registrados en este día para clonar.' });
      return;
    }

    this.loading.set(true);
    this.empleadoService.cloneDay(id, sourceStr, targetStr).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Horario clonado correctamente para el día seleccionado.' });
        this.showCloneDayModal.set(false);
        this.loadSchedule(id);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al clonar' });
        this.loading.set(false);
      }
    });
  }

  openCleanDialog() {
    const current = new Date(this.currentDate());
    const mode    = this.viewMode();
    let start     = new Date(current);
    let end       = new Date(current);

    if (mode === 'month') {
      start = new Date(current.getFullYear(), current.getMonth(), 1);
      end   = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    } else if (mode === 'week') {
      const day  = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      start      = new Date(current.setDate(diff));
      end        = new Date(start);
      end.setDate(start.getDate() + 6);
    }

    this.cleanStartDate.set(start.toISOString().split('T')[0]);
    this.cleanEndDate.set(end.toISOString().split('T')[0]);
    this.selectedCleanDays.set(new Set<string>());
    this.showCleanModal.set(true);
  }

  closeCleanDialog() {
    this.showCleanModal.set(false);
  }

  toggleCleanDay(day: string) {
    const current = new Set(this.selectedCleanDays());
    if (current.has(day)) current.delete(day);
    else                  current.add(day);
    this.selectedCleanDays.set(current);
  }

  confirmClean() {
    const id = this.selectedEmployeeId();
    if (!id) return;

    const startStr = this.cleanStartDate();
    const endStr   = this.cleanEndDate();

    if (!startStr || !endStr) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Por favor selecciona las fechas de inicio y fin.' });
      return;
    }
    if (new Date(startStr) > new Date(endStr)) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'La fecha de inicio no puede ser posterior a la de fin.' });
      return;
    }

    const daysArray = Array.from(this.selectedCleanDays());
    const daysLabel = daysArray.length > 0 ? `los días ${daysArray.join(', ')}` : 'todos los días';

    this.showCleanModal.set(false);
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar permanentemente los turnos de ${this.selectedEmployeeName()} desde el ${startStr} hasta el ${endStr} para ${daysLabel}? Esta acción no se puede deshacer.`,
      header: 'Confirmar Eliminación Masiva',
      icon: 'pi pi-trash',
      acceptLabel: 'Sí, eliminar todo',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.loading.set(true);
        this.empleadoService.deleteBulkSchedule(id, startStr, endStr, daysArray).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Horarios eliminados correctamente.' });
            this.loadSchedule(id);
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al eliminar horarios.' });
            this.loading.set(false);
            this.showCleanModal.set(true);
          }
        });
      },
      reject: () => {
        this.showCleanModal.set(true);
      }
    });
  }

  exportPdf() {
    const empName = this.selectedEmployeeName();
    if (!empName) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Selecciona un empleado para exportar' });
      return;
    }

    this.messageService.add({ severity: 'success', summary: 'Generando Reporte', detail: `Preparando PDF de ${empName}...` });

    const printContent = document.getElementById('print-area');
    if (!printContent) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se encontró el contenedor de impresión' });
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width    = '0px';
    iframe.style.height   = '0px';
    iframe.style.border   = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cuadrante de Horario - ${empName}</title>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap">
            <style>
              body { font-family: 'Outfit', sans-serif; color: #0f172a; background-color: #ffffff; margin: 0; padding: 40px; -webkit-print-color-adjust: exact; }
              .print-header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
              .print-logo-title { display: flex; flex-direction: column; }
              .print-logo-text { font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1; }
              .print-subtitle { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
              .print-report-info { text-align: right; font-size: 11px; color: #475569; line-height: 1.5; }
              .print-employee-card { background: #ffffff; border: 1px solid #0f172a; border-radius: 0 !important; padding: 16px 20px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
              .print-card-field { display: flex; flex-direction: column; }
              .print-field-label { font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
              .print-field-value { font-size: 14px; font-weight: 600; color: #0f172a; }
              .print-highlight-value { color: #000000; font-size: 16px; font-weight: 800; }
              .print-matrix-table-container { border: 1px solid #0f172a; border-radius: 0 !important; overflow: hidden; margin-bottom: 30px; background: #ffffff; }
              .print-table { width: 100%; border-collapse: collapse; }
              .print-table th { background: #f8fafc !important; color: #0f172a !important; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px; text-align: center; border: 1px solid #0f172a; }
              .print-table th:first-child { text-align: left; border-left: none; }
              .print-table th:last-child { border-right: none; }
              .print-table td { border: 1px solid #0f172a; padding: 8px; vertical-align: middle; text-align: center; font-size: 11px; border-radius: 0 !important; }
              .print-table td:first-child { border-left: none; }
              .print-table td:last-child { border-right: none; }
              .print-table tr:last-child td { border-bottom: none; }
              .print-week-cell { background: #f8fafc !important; text-align: left; width: 130px; font-weight: 800; color: #0f172a; padding-left: 12px; }
              .print-week-dates { font-size: 10px; color: #475569; font-weight: 700; }
              .print-week-dates-sub { font-size: 9px; color: #64748b; font-weight: 600; }
              .print-shift-cell { background: #ffffff; }
              .print-empty-cell { color: #cbd5e1; font-size: 12px; font-weight: 500; background: #ffffff !important; }
              .print-matrix-shift-box { background: #ffffff !important; border: 1px solid #0f172a !important; border-radius: 0 !important; padding: 6px; text-align: center; display: inline-block; width: 100%; box-sizing: border-box; }
              .print-time-range { font-size: 10px; font-weight: 800; color: #000000; }
              .print-duration-tag { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #475569; margin-top: 2px; }
              .print-empty-state-row { padding: 30px; text-align: center; color: #64748b; font-size: 12px; font-weight: 500; background: #ffffff !important; }
              .print-footer-notes { margin-top: 50px; border-top: 1px solid #0f172a; padding-top: 20px; font-size: 10px; color: #64748b; text-align: center; font-weight: 500; line-height: 1.6; }
              @media print {
                body { padding: 10px; }
                .print-matrix-table-container { border-radius: 0 !important; }
                .print-table th { background: #f8fafc !important; color: #0f172a !important; print-color-adjust: exact; }
                .print-matrix-shift-box { background: #ffffff !important; border: 1px solid #0f172a !important; border-radius: 0 !important; print-color-adjust: exact; }
                .print-week-cell { background: #f8fafc !important; print-color-adjust: exact; }
                .print-empty-cell { background: #ffffff !important; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>${printContent.innerHTML}</body>
        </html>
      `);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 500);
    }
  }

  async exportExcel() {
    const empName = this.selectedEmployeeName();
    if (!empName) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Selecciona un empleado para exportar' });
      return;
    }

    this.messageService.add({ severity: 'success', summary: 'Generando Reporte', detail: `Preparando Excel de ${empName}...` });

    const cargo    = this.selectedEmployeeCargo();
    const dateStr  = new Date().toLocaleDateString('es-PE');
    const totalHrs = this.totalShiftsHours();
    const weeks    = this.printableWeeks();
    const days     = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const headerFill = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
    const thinBorder = (): Partial<ExcelJS.Borders> => ({ top: { style: 'thin', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FF94A3B8' } }, bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }, right: { style: 'thin', color: { argb: 'FF94A3B8' } } });
    const gridBorder = (): Partial<ExcelJS.Borders> => ({ top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } });
    const darkBorder = (): Partial<ExcelJS.Borders> => ({ top: { style: 'thin', color: { argb: 'FF1E293B' } }, left: { style: 'thin', color: { argb: 'FF1E293B' } }, bottom: { style: 'thin', color: { argb: 'FF1E293B' } }, right: { style: 'thin', color: { argb: 'FF1E293B' } } });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VargasVet Sistema';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(`Horario ${empName}`, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      properties: { tabColor: { argb: 'FF0F172A' } },
    });

    sheet.columns = [
      { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 },
      { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    ];

    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value     = 'VARGASVET — CUADRANTE CONSOLIDADO DE TRABAJO';
    titleCell.font      = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FF0F172A' } };
    titleCell.fill      = headerFill('FFF8FAFC');
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    titleCell.border    = { bottom: { style: 'medium', color: { argb: 'FF0F172A' } } };
    sheet.getRow(1).height = 32;
    sheet.getRow(2).height = 8;

    const metaRows: [string, string, string, string][] = [
      ['Colaborador',    empName, 'Fecha de Emisión',        dateStr            ],
      ['Cargo / Función', cargo,  'Total Horas Registradas', `${totalHrs} hrs`  ],
    ];
    metaRows.forEach((meta, i) => {
      const rowIdx = 3 + i;
      const row    = sheet.getRow(rowIdx);
      row.height   = 22;

      const labelA    = sheet.getCell(`A${rowIdx}`);
      labelA.value    = meta[0];
      labelA.font     = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1E293B' } };
      labelA.fill     = headerFill('FFF1F5F9');
      labelA.border   = thinBorder();
      labelA.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      sheet.mergeCells(`B${rowIdx}:D${rowIdx}`);
      const valueA    = sheet.getCell(`B${rowIdx}`);
      valueA.value    = meta[1];
      valueA.font     = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      valueA.border   = thinBorder();
      valueA.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      const labelB    = sheet.getCell(`E${rowIdx}`);
      labelB.value    = meta[2];
      labelB.font     = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1E293B' } };
      labelB.fill     = headerFill('FFF1F5F9');
      labelB.border   = thinBorder();
      labelB.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      sheet.mergeCells(`F${rowIdx}:H${rowIdx}`);
      const valueB    = sheet.getCell(`F${rowIdx}`);
      valueB.value    = meta[3];
      valueB.font     = i === 1 ? { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF0F172A' } } : { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      valueB.fill     = i === 1 ? headerFill('FFE2E8F0') : headerFill('FFFFFFFF');
      valueB.border   = thinBorder();
      valueB.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    });

    sheet.getRow(5).height = 12;

    const hdrRow   = sheet.getRow(6);
    hdrRow.height  = 28;
    ['Periodo / Semana', ...days].forEach((label, col) => {
      const cell      = hdrRow.getCell(col + 1);
      cell.value      = label.toUpperCase();
      cell.font       = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill       = headerFill(col === 0 ? 'FF0F172A' : 'FF1E293B');
      cell.border     = darkBorder();
      cell.alignment  = { horizontal: col === 0 ? 'left' : 'center', vertical: 'middle', indent: col === 0 ? 1 : 0 };
    });

    let currentRow = 7;
    if (weeks.length === 0) {
      sheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const emptyCell     = sheet.getCell(`A${currentRow}`);
      emptyCell.value     = 'No hay turnos planificados asignados a este colaborador.';
      emptyCell.font      = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF64748B' } };
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyCell.border    = gridBorder();
      sheet.getRow(currentRow).height = 28;
    } else {
      weeks.forEach((week: any, idx: number) => {
        const row   = sheet.getRow(currentRow);
        row.height  = 40;
        const altBg = idx % 2 === 1 ? 'FFF1F5F9' : 'FFFFFFFF';

        const weekCell      = row.getCell(1);
        weekCell.value      = { richText: [
          { text: week.title + '\n', font: { name: 'Calibri', bold: true,  size: 9, color: { argb: 'FF0F172A' } } },
          { text: week.subtitle,     font: { name: 'Calibri', bold: false, size: 8, color: { argb: 'FF475569' } } },
        ]};
        weekCell.fill       = headerFill('FFF8FAFC');
        weekCell.border     = gridBorder();
        weekCell.alignment  = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };

        week.days.forEach((day: any, d: number) => {
          const cell      = row.getCell(d + 2);
          cell.border     = gridBorder();
          cell.alignment  = { horizontal: 'center', vertical: 'middle', wrapText: true };
          if (day.shifts && day.shifts.length > 0) {
            const lines = day.shifts.map((s: any) => `${s.timeRange}  (${s.duration}h)`).join('\n');
            cell.value  = lines;
            cell.font   = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FF0F172A' } };
            cell.fill   = headerFill(idx % 2 === 1 ? 'FFE0F2FE' : 'FFF0F9FF');
          } else {
            cell.value  = '–';
            cell.font   = { name: 'Calibri', size: 11, color: { argb: 'FFCBD5E1' } };
            cell.fill   = headerFill(altBg);
          }
        });
        currentRow++;
      });
    }

    currentRow++;
    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const footerCell      = sheet.getCell(`A${currentRow}`);
    footerCell.value      = `Este cuadrante representa la planificación de turnos vigente. Toda modificación deberá ser autorizada por la Gerencia de Operaciones de VargasVet S.A.C. — Emitido el ${dateStr}`;
    footerCell.font       = { name: 'Calibri', italic: true, size: 8, color: { argb: 'FF94A3B8' } };
    footerCell.alignment  = { horizontal: 'center', vertical: 'middle', wrapText: true };
    footerCell.border     = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    sheet.getRow(currentRow).height = 28;

    const buffer   = await workbook.xlsx.writeBuffer();
    const blob     = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link     = document.createElement('a');
    link.href      = URL.createObjectURL(blob);
    link.download  = `Horario_${empName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
