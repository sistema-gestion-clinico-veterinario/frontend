import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EmpleadoService } from '../../../../../../core/services/empleado.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-schedule-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToastModule],
  templateUrl: './schedule-form.component.html',
  styleUrl: './schedule-form.component.scss'
})
export class ScheduleFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly messageService = inject(MessageService);

  @Input() visible = false;
  @Input() employeeId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  loading = signal(false);

  scheduleForm: FormGroup = this.fb.group({
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    horaInicio: ['08:00', Validators.required],
    horaFin: ['17:00', Validators.required],
    dias: [[]]
  });

  readonly diasSemana = [
    { key: 'LUNES', label: 'L' },
    { key: 'MARTES', label: 'M' },
    { key: 'MIERCOLES', label: 'X' },
    { key: 'JUEVES', label: 'J' },
    { key: 'VIERNES', label: 'V' },
    { key: 'SABADO', label: 'S' },
    { key: 'DOMINGO', label: 'D' },
  ];

  toggleDay(day: string) {
    const current = this.scheduleForm.get('dias')?.value as string[];
    if (current.includes(day)) {
      this.scheduleForm.get('dias')?.setValue(current.filter(d => d !== day));
    } else {
      this.scheduleForm.get('dias')?.setValue([...current, day]);
    }
  }

  isDaySelected(day: string): boolean {
    return (this.scheduleForm.get('dias')?.value as string[]).includes(day);
  }

  onSave() {
    if (this.scheduleForm.invalid || !this.employeeId) {
      this.scheduleForm.markAllAsTouched();
      return;
    }

    const form = this.scheduleForm.value;
    
    // Convertir días seleccionados en una lista de turnos (un turno por día)
    const selectedDays = form.dias as string[];
    const shifts = selectedDays.map(day => ({
      diaSemana: day,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin
    }));

    const request = {
      startDate: form.fechaInicio,
      endDate: form.fechaFin,
      overwrite: false,
      shifts: shifts.length > 0 ? shifts : [{
        horaInicio: form.horaInicio,
        horaFin: form.horaFin
      }]
    };

    this.loading.set(true);
    this.empleadoService.assignBulkSchedule(this.employeeId, request).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Horario asignado correctamente' });
        this.loading.set(false);
        this.saved.emit();
        this.close.emit();
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo asignar el horario' });
        this.loading.set(false);
      }
    });
  }
}
