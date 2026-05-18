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
import { Permission } from '../../../../core/enums/permission.enum';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

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

  readonly Permission = Permission;

  public volviendoAlPresente() {
    this.currentDate = new Date();
    this.generateCalendar();
  }

  empleadoId!: number;
  empleadoNombre: string = 'Cargando...';
  horarios: HorarioEmpleadoResponse[] = [];
  displayBulkModal: boolean = false;
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
      const dayShifts = this.horarios.filter(h => new Date(h.fecha).toDateString() === date.toDateString());
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
    const request = {
      startDate: val.dateRange[0],
      endDate: val.dateRange[1] || val.dateRange[0],
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
