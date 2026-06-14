import { Component, Input, Output, EventEmitter, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EmpleadoService } from '../../../../../../core/services/empleado.service';
import { CompanyService } from '../../../../../../core/services/company.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-schedule-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToastModule],
  templateUrl: './schedule-form.component.html',
  styleUrl: './schedule-form.component.scss'
})
export class ScheduleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  companyInfo = signal<any>(null);
  currentData = signal<any>(null);
  selectedStartDate = signal<string>('');
  selectedEndDate = signal<string>('');

  @Input() scheduleRange: { start: string, end: string } | null = null;

  clinicHoursInfo = computed(() => {
    const info = this.companyInfo();
    const dateStr = this.scheduleForm.get('fechaInicio')?.value;
    if (!info || !info.operatingHours || !dateStr) return null;

    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = this.dayOfWeekMap[date.getDay()];
    
    const op = info.operatingHours.find((h: any) => h.diaSemana === dayName);
    if (!op) return null;
    if (!op.isOpen) return `La clínica permanece CERRADA los días ${dayName}.`;
    
    return `Atención ${dayName}: ${op.openingTime.substring(0, 5)} a ${op.closingTime.substring(0, 5)}`;
  });

  availableDays = computed(() => {
    const startStr = this.selectedStartDate();
    const endStr = this.selectedEndDate();
    if (!startStr || !endStr) {
      return new Set<string>(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
    }

    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

    if (start > end) {
      return new Set<string>();
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 6) {
      return new Set<string>(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
    }

    const days = new Set<string>();
    const tempDate = new Date(start);
    while (tempDate <= end) {
      const dayName = this.dayOfWeekMap[tempDate.getDay()];
      days.add(dayName);
      tempDate.setDate(tempDate.getDate() + 1);
    }
    return days;
  });

  private _visible = false;

  @Input() set visible(value: boolean) {
    this._visible = value;
    if (!value) {
      this.resetFormState();
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  @Input() employeeId: number | null = null;
  @Input() employeeName: string = '';
  @Input() set initialData(data: any) {
    if (data) {
      // Si el objeto tiene ID, es una edición real
      if (data.id) {
        this.currentData.set(data);
        this.selectedStartDate.set(data.fecha || '');
        this.selectedEndDate.set(data.fecha || '');
        this.scheduleForm.patchValue({
          fechaInicio: data.fecha,
          fechaFin: data.fecha,
          horaInicio: data.horaInicio ? data.horaInicio.substring(0, 5) : '08:00',
          horaFin: data.horaFin ? data.horaFin.substring(0, 5) : '17:00',
          dias: data.diaSemana ? [data.diaSemana] : [],
          editMode: 'single'
        });
      } else {
        // Si no tiene ID, es una preselección de fecha para crear
        this.currentData.set(null);
        this.selectedStartDate.set(data.fecha || '');
        this.selectedEndDate.set(data.fecha || '');
        this.scheduleForm.reset({
          fechaInicio: data.fecha,
          fechaFin: data.fecha,
          horaInicio: '',
          horaFin: '',
          dias: [],
          editMode: 'single'
        });
      }
    } else {
      this.resetFormState();
    }
  }
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  loading = signal(false);

  scheduleForm: FormGroup = this.fb.group({
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    horaInicio: ['', Validators.required],
    horaFin: ['', Validators.required],
    dias: [[]],
    editMode: ['single']
  });

  readonly dayOfWeekMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

  private resetFormState() {
    this.currentData.set(null);
    this.selectedStartDate.set('');
    this.selectedEndDate.set('');
    this.loading.set(false);
    this.scheduleForm.reset({
      fechaInicio: '',
      fechaFin: '',
      horaInicio: '',
      horaFin: '',
      dias: [],
      editMode: 'single'
    });
  }

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

  setEditMode(mode: 'single' | 'bulk') {
    this.scheduleForm.get('editMode')?.setValue(mode);
    
    if (mode === 'single') {
      const data = this.currentData();
      if (data) {
        this.scheduleForm.patchValue({
          fechaInicio: data.fecha,
          fechaFin: data.fecha,
          dias: data.diaSemana ? [data.diaSemana] : []
        });
      } else {
        const start = this.scheduleForm.get('fechaInicio')?.value;
        this.scheduleForm.get('fechaFin')?.setValue(start);
        if (start) {
          const [y, m, d] = start.split('-').map(Number);
          const dayName = this.dayOfWeekMap[new Date(y, m - 1, d).getDay()];
          this.scheduleForm.get('dias')?.setValue([dayName]);
        }
      }
    } else if (mode === 'bulk') {
      const start = this.scheduleForm.get('fechaInicio')?.value;
      const end = this.scheduleForm.get('fechaFin')?.value;
      if (start === end && start) {
        if (this.scheduleRange?.end && this.scheduleRange.end > start) {
          this.scheduleForm.get('fechaFin')?.setValue(this.scheduleRange.end);
        } else {
          const date = new Date(start + 'T00:00:00');
          date.setDate(date.getDate() + 30);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const nextDate = `${y}-${m}-${d}`;
          this.scheduleForm.get('fechaFin')?.setValue(nextDate);
        }
      }
    }
  }

  ngOnInit() {
    this.companyService.getCompany().subscribe(res => {
      this.companyInfo.set(res.data);
    });

    // Escuchar cambios de fecha para limpiar días seleccionados fuera de rango y actualizar señales reactivas
    this.scheduleForm.get('fechaInicio')?.valueChanges.subscribe(val => {
      this.selectedStartDate.set(val || '');
      this.filterSelectedDays();
    });
    this.scheduleForm.get('fechaFin')?.valueChanges.subscribe(val => {
      this.selectedEndDate.set(val || '');
      this.filterSelectedDays();
    });
  }

  filterSelectedDays() {
    const current = this.scheduleForm.get('dias')?.value as string[];
    if (!current || current.length === 0) return;
    const available = this.availableDays();
    const filtered = current.filter(d => available.has(d));
    
    if (filtered.length !== current.length) {
      this.scheduleForm.get('dias')?.setValue(filtered);
    }
  }

  onSave() {
    if (this.scheduleForm.invalid || !this.employeeId) {
      this.scheduleForm.markAllAsTouched();
      return;
    }

    const form = this.scheduleForm.value;
    const isEditing = !!this.currentData();
    const editMode = form.editMode;
    const selectedDays = form.dias as string[];

    if (!this.employeeId) return;
    if (form.fechaFin < form.fechaInicio) {
      this.messageService.add({ severity: 'warn', summary: 'Rango invalido', detail: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
      return;
    }
    const diffDays = Math.ceil((new Date(form.fechaFin + 'T00:00:00').getTime() - new Date(form.fechaInicio + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      this.messageService.add({ severity: 'warn', summary: 'Rango muy amplio', detail: 'El rango no debe superar 366 dias.' });
      return;
    }
    if (form.horaFin <= form.horaInicio) {
      this.messageService.add({ severity: 'warn', summary: 'Horario invalido', detail: 'La hora de fin debe ser posterior a la hora de inicio.' });
      return;
    }
    if (editMode === 'bulk' && selectedDays.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Dias requeridos', detail: 'Seleccione al menos un dia dentro del rango.' });
      return;
    }

    // Validar contra horario de clínica
    if (!this.validarContraClinica(form)) return;

    if (isEditing && editMode === 'single') {
      // ACTUALIZACIÓN PUNTUAL
      this.confirmationService.confirm({
        message: `¿Estás seguro de actualizar el turno del día ${form.fechaInicio} a las ${form.horaInicio}?`,
        header: 'Confirmar Actualización',
        icon: 'pi pi-info-circle',
        acceptLabel: 'Sí, actualizar',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-info p-button-sm',
        accept: () => {
          const [y, m, d] = form.fechaInicio.split('-').map(Number);
          const diaNum = new Date(y, m - 1, d).getDay();
          
          const updateReq = {
            fecha: form.fechaInicio,
            horaInicio: form.horaInicio,
            horaFin: form.horaFin,
            diaSemana: this.dayOfWeekMap[diaNum]
          };
          this.loading.set(true);
          this.empleadoService.updateHorario(this.currentData().id, updateReq).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Horario actualizado correctamente' });
              this.loading.set(false);
              this.saved.emit();
              this.close.emit();
            },
            error: (err) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al actualizar' });
              this.loading.set(false);
            }
          });
        }
      });
    } else {
      // OPERACIÓN MASIVA
      const actionLabel = isEditing ? 'actualizar masivamente' : 'asignar';
      const rangeLabel = `${form.fechaInicio} al ${form.fechaFin}`;
      
      this.confirmationService.confirm({
        message: `¿Estás seguro de ${actionLabel} el horario para el rango ${rangeLabel}?`,
        header: 'Confirmar Acción Masiva',
        icon: 'pi pi-clone',
        acceptLabel: 'Sí, procesar',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-primary p-button-sm',
        accept: () => {
          const shifts = selectedDays.map((day: string) => ({
            diaSemana: day,
            horaInicio: form.horaInicio,
            horaFin: form.horaFin
          }));

          const request: any = {
            startDate: form.fechaInicio,
            endDate: form.fechaFin,
            overwrite: isEditing,
            originalStartTime: isEditing ? this.currentData().horaInicio.substring(0, 5) : null,
            shifts: shifts.length > 0 ? shifts : []
          };

          if (shifts.length === 0) {
            request.shifts = [{
              diaSemana: null as any,
              horaInicio: form.horaInicio,
              horaFin: form.horaFin
            }];
          }

          this.loading.set(true);
          this.empleadoService.assignBulkSchedule(this.employeeId!, request).subscribe({
            next: () => {
              const msg = isEditing ? 'Horario masivo actualizado' : 'Horario asignado correctamente';
              this.messageService.add({ severity: 'success', summary: 'Éxito', detail: msg });
              this.loading.set(false);
              this.saved.emit();
              this.close.emit();
            },
            error: (err: any) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo procesar el horario' });
              this.loading.set(false);
            }
          });
        }
      });
    }
  }

  private validarContraClinica(form: any): boolean {
    const info = this.companyInfo();
    if (!info || !info.operatingHours) return true;

    // Parsear fecha manualmente para evitar desfases de zona horaria (UTC vs Local)
    const [year, month, day] = form.fechaInicio.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    
    const diaNum = fecha.getDay();
    const diaBackend = this.dayOfWeekMap[diaNum];
    
    const opHour = info.operatingHours.find((h: any) => h.diaSemana === diaBackend);
    if (!opHour) return true;

    if (!opHour.isOpen) {
      this.messageService.add({ severity: 'error', summary: 'Cerrado', detail: `La clínica no abre los días ${diaBackend}` });
      return false;
    }

    const start = form.horaInicio;
    const end = form.horaFin;
    const clinicStart = opHour.openingTime.substring(0, 5);
    const clinicEnd = opHour.closingTime.substring(0, 5);

    if (start >= end) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Rango Inválido', 
        detail: 'La hora de entrada debe ser estrictamente anterior a la hora de salida.' 
      });
      return false;
    }

    if (start < clinicStart || end > clinicEnd) {
      const companyName = info.name || 'la clínica';
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Horario Fuera de Rango', 
        detail: `${companyName} atiende de ${clinicStart} a ${clinicEnd} los días ${diaBackend}. Por favor, ajusta el turno dentro de este intervalo.` 
      });
      return false;
    }

    return true;
  }
}
