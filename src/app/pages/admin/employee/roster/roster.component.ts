import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EmpleadoService } from '../../../../core/services/empleado.service';
import { EmpleadoListResponse } from '../../../../models/response/empleado-list-response';
import { Permission } from '../../../../core/enums/permission.enum';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { AuthStore } from '../../../../store/auth.store';

import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { ScheduleFormComponent } from './components/schedule-form/schedule-form.component';

@Component({
  selector: 'app-roster',
  standalone: true,
  imports: [CommonModule, RouterModule, DropdownModule, ButtonModule, ToastModule, FormsModule, ScheduleFormComponent],
  providers: [MessageService],
  templateUrl: './roster.component.html',
  styleUrl: './roster.component.scss'
})
export class RosterComponent {
  private readonly empleadoService = inject(EmpleadoService);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);

  employees = signal<{label: string, value: number}[]>([]);
  selectedEmployeeId = signal<number | null>(null);
  showSidebar = signal<boolean>(false);
  shifts = signal<any[]>([]);
  dayViewHours = signal<any[]>([]);
  
  viewMode = signal<'day' | 'week' | 'month'>('month');
  currentDate = signal<Date>(new Date());
  calendarDays = signal<any[]>([]);
  loading = signal<boolean>(false);
  
  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  readonly viewOptions = [
    { label: 'Día', value: 'day' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' }
  ];

  constructor() {
    effect(() => {
      const companyId = this.authStore.selectedEnterprise()?.establishmentId || this.authStore.companyId();
      if (companyId) {
        this.loadEmployeeList(companyId);
      }
    });

    effect(() => {
      const empId = this.selectedEmployeeId();
      const mode = this.viewMode();
      const date = this.currentDate();
      if (empId) {
        this.loadSchedule(empId);
      } else {
        this.calendarDays.set([]);
      }
    });
  }

  loadEmployeeList(companyId: number) {
    this.empleadoService.listar(companyId, undefined, 0, 1000).subscribe({
      next: (res) => {
        const list = res.data.content.map(e => ({ label: `${e.nombre} ${e.apellido}`, value: e.id }));
        this.employees.set(list);
      }
    });
  }

  loadSchedule(id: number) {
    this.loading.set(true);
    this.empleadoService.getHorario(id).subscribe({
      next: (res) => {
        // Handle null dates in sorting to avoid issues
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

  generateCalendar() {
    const days: any[] = [];
    const date = new Date(this.currentDate());
    
    // Map for enum matching
    const dayOfWeekMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

    if (this.viewMode() === 'month') {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const startDay = start.getDay();
      const prevMonthEnd = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
      
      for (let i = startDay - 1; i >= 0; i--) {
        days.push({ day: prevMonthEnd - i, otherMonth: true });
      }
      
      for (let i = 1; i <= end.getDate(); i++) {
        const current = new Date(date.getFullYear(), date.getMonth(), i);
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = dayOfWeekMap[current.getDay()];

        // Match by specific date OR by day of week if fecha is null
        const dayShifts = this.shifts().filter((s: any) => 
          s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
        );

        days.push({
          day: i,
          date: current,
          isToday: this.isToday(current),
          shifts: dayShifts
        });
      }
    } else if (this.viewMode() === 'week') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      
      for (let i = 0; i < 7; i++) {
        const current = new Date(startOfWeek);
        current.setDate(startOfWeek.getDate() + i);
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = dayOfWeekMap[current.getDay()];

        const dayShifts = this.shifts().filter((s: any) => 
          s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
        );

        days.push({
          day: current.getDate(),
          date: current,
          isToday: this.isToday(current),
          shifts: dayShifts
        });
      }
    } else {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = dayOfWeekMap[date.getDay()];
      
      const dayShifts = this.shifts().filter((s: any) => 
        s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
      );

      days.push({
        day: date.getDate(),
        date: date,
        isToday: this.isToday(date),
        shifts: dayShifts
      });
    }
    
    this.calendarDays.set(days);
    
    // Generar vista de horas para el modo día
    if (this.viewMode() === 'day') {
      this.generateDayHourView();
    }
  }

  generateDayHourView() {
    const date = new Date(this.currentDate());
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeekMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const dayOfWeek = dayOfWeekMap[date.getDay()];

    const dayShifts = this.shifts().filter((s: any) =>
      s.fecha === dateStr || (!s.fecha && s.diaSemana === dayOfWeek)
    );

    const hours: any[] = [];
    for (let h = 0; h <= 23; h++) {
      const timeStr = `${h.toString().padStart(2, '0')}:00`;
      const nextTimeStr = `${(h + 1).toString().padStart(2, '0')}:00`;

      // Verificar si esta hora está dentro de algún turno
      const coveringShift = dayShifts.find((s: any) => {
        const start = s.horaInicio.substring(0, 5);
        const end = s.horaFin.substring(0, 5);
        return timeStr >= start && timeStr < end;
      });

      // Verificar si es el inicio exacto de un turno
      const isShiftStart = dayShifts.some((s: any) => s.horaInicio.substring(0, 5) === timeStr);
      const isShiftEnd = dayShifts.some((s: any) => s.horaFin.substring(0, 5) === nextTimeStr);

      hours.push({
        hour: h,
        label: timeStr,
        isWorking: !!coveringShift,
        isShiftStart,
        isShiftEnd,
        shift: coveringShift || null
      });
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

  onEmployeeChange(value: string) {
    if (value === 'null') {
      this.selectedEmployeeId.set(null);
    } else {
      this.selectedEmployeeId.set(Number(value));
    }
  }

  prev() {
    const d = new Date(this.currentDate());
    const mode = this.viewMode();
    if (mode === 'month') d.setMonth(d.getMonth() - 1);
    else if (mode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    
    this.currentDate.set(d);
    if (this.selectedEmployeeId()) this.loadSchedule(this.selectedEmployeeId()!);
  }

  next() {
    const d = new Date(this.currentDate());
    const mode = this.viewMode();
    if (mode === 'month') d.setMonth(d.getMonth() + 1);
    else if (mode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);

    this.currentDate.set(d);
    if (this.selectedEmployeeId()) this.loadSchedule(this.selectedEmployeeId()!);
  }

  get currentLabel(): string {
    const d = this.currentDate();
    const mode = this.viewMode();
    if (mode === 'month') return `${this.monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (mode === 'week') {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} ${this.monthNames[start.getMonth()].substring(0,3)} - ${end.getDate()} ${this.monthNames[end.getMonth()].substring(0,3)}`;
    }
    return `${d.getDate()} ${this.monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  deleteShift(id: number) {
    if (confirm('¿Estás seguro de eliminar este turno?')) {
      this.empleadoService.deleteHorario(id).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Turno eliminado' });
          if (this.selectedEmployeeId()) this.loadSchedule(this.selectedEmployeeId()!);
        }
      });
    }
  }
}
