import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Calendar } from 'primeng/calendar';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Checkbox } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ActivatedRoute } from '@angular/router';
import { EmpleadoService } from '../../../../core/services/empleado.service';
import { HorarioEmpleadoResponse } from '../../../../models/response/horario-empleado-response';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { toDateInputKey } from '../../../../core/utils/input-validation.util';

@Component({
  selector: 'app-schedule-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Calendar,
    Toast,
    ConfirmDialog,
    Checkbox
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './schedule-management.component.html',
  styleUrls: ['./schedule-management.component.scss']
})
export class ScheduleManagementComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);

  public volviendoAlPresente() {
    this.currentDate = new Date();
    this.generateCalendar();
  }

  empleadoId!: number;
  empleadoNombre: string = 'Cargando...';
  horarios: HorarioEmpleadoResponse[] = [];
  displayBulkModal: boolean = false;
  displayShiftDetail: boolean = false;
  selectedShift: HorarioEmpleadoResponse | null = null;
  selectedShiftDate: Date | null = null;
  loading: boolean = false;

  currentDate = new Date();
  calendarDays: any[] = [];
  monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  bulkForm: FormGroup = this.fb.group({
    dateRange: [null, [Validators.required]],
    overwrite: [false],
    shifts: this.fb.array([])
  });

  get shifts() {
    return this.bulkForm.get('shifts') as FormArray;
  }

  ngOnInit() {
    this.empleadoId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadEmployeeSchedule();
    this.generateCalendar();
    this.addShift(); // Initialize with one shift
  }

  loadEmployeeSchedule() {
    this.loading = true;
    this.empleadoService.getHorario(this.empleadoId).subscribe({
      next: (res) => {
        this.horarios = res.data;
        this.generateCalendar();
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el horario' });
        this.loading = false;
      }
    });
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay();
    const days: any[] = [];

    // Prev month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, otherMonth: true, date: new Date(year, month - 1, prevMonthLastDay - i) });
    }

    // Current month days
    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const isToday = date.toDateString() === today.toDateString();
      const dayShifts = this.horarios.filter(h => this.matchFecha(h.fecha, date));
      days.push({ day: i, otherMonth: false, isToday, date, shifts: dayShifts });
    }

    // Next month days
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      days.push({ day: i, otherMonth: true, date: new Date(year, month + 1, i) });
    }

    this.calendarDays = days;
  }
  

  prevMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendar();
  }



  private matchFecha(fecha: string, date: Date): boolean {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(y, m - 1, d).toDateString() === date.toDateString();
  }

  selectedShiftDateFormatted: string = '';

  verDetalleHorario(shift: HorarioEmpleadoResponse, date: Date) {
    this.selectedShift = shift;
    this.selectedShiftDate = date;
    this.selectedShiftDateFormatted = date.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    this.displayShiftDetail = true;
  }

  calcularDuracion(horaInicio: string, horaFin: string): string {
    if (!horaInicio || !horaFin) return '–';
    const [h1, m1] = horaInicio.split(':').map(Number);
    const [h2, m2] = horaFin.split(':').map(Number);
    const totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMin <= 0) return '–';
    const horas = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return horas > 0 ? `${horas}h ${mins > 0 ? mins + 'min' : ''}`.trim() : `${mins}min`;
  }

  addShift() {
    this.shifts.push(this.fb.group({
      horaInicio: ['08:00', Validators.required],
      horaFin: ['13:00', Validators.required]
    }));
  }

  removeShift(index: number) {
    this.shifts.removeAt(index);
  }

  openBulkModal() {
    this.displayBulkModal = true;
  }

  saveBulkSchedule() {
    if (this.bulkForm.invalid) {
      this.bulkForm.markAllAsTouched();
      return;
    }

    const val = this.bulkForm.value;
    const startDate = toDateInputKey(val.dateRange?.[0]);
    const endDate = toDateInputKey(val.dateRange?.[1] || val.dateRange?.[0]);
    if (!startDate || !endDate) {
      this.messageService.add({ severity: 'warn', summary: 'Fecha invalida', detail: 'Seleccione un rango de fechas valido.' });
      return;
    }
    if (endDate < startDate) {
      this.messageService.add({ severity: 'warn', summary: 'Rango invalido', detail: 'La fecha final no puede ser anterior a la fecha inicial.' });
      return;
    }
    if (val.shifts.some((s: any) => !s.horaInicio || !s.horaFin || s.horaFin <= s.horaInicio)) {
      this.messageService.add({ severity: 'warn', summary: 'Turno invalido', detail: 'Cada turno debe tener hora fin posterior a hora inicio.' });
      return;
    }
    const request = {
      startDate,
      endDate,
      shifts: val.shifts,
      overwrite: val.overwrite
    };

    this.loading = true;
    this.empleadoService.assignBulkSchedule(this.empleadoId, request).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Horario asignado correctamente' });
        this.displayBulkModal = false;
        this.loadEmployeeSchedule();
      },
      error: (err: any) => {
        const errorMsg = err.error?.message || 'Error al asignar horario';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: errorMsg });
        this.loading = false;
      }
    });
  }
}
