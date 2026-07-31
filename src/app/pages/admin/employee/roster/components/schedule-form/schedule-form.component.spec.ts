import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduleFormComponent } from './schedule-form.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CompanyService } from '../../../../../../core/services/company.service';
import { EmpleadoService } from '../../../../../../core/services/empleado.service';
import { of } from 'rxjs';

describe('ScheduleFormComponent', () => {
  let component: ScheduleFormComponent;
  let fixture: ComponentFixture<ScheduleFormComponent>;

  beforeEach(async () => {
    const companySpy = jasmine.createSpyObj('CompanyService', ['getCompany']);
    companySpy.getCompany.and.returnValue(of({ data: null }));

    await TestBed.configureTestingModule({
      imports: [ScheduleFormComponent, HttpClientTestingModule],
      providers: [
        MessageService,
        ConfirmationService,
        { provide: CompanyService, useValue: companySpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('availableDays', () => {
    it('returns all 7 days when no start or end date is set', () => {
      component.selectedStartDate.set('');
      component.selectedEndDate.set('');
      expect(component.availableDays().size).toBe(7);
    });

    it('returns an empty Set when start date is after end date', () => {
      component.selectedStartDate.set('2025-01-10');
      component.selectedEndDate.set('2025-01-05');
      expect(component.availableDays().size).toBe(0);
    });

    it('returns all 7 days when the date range spans 6 or more days', () => {
      component.selectedStartDate.set('2025-01-06');
      component.selectedEndDate.set('2025-01-12');
      expect(component.availableDays().size).toBe(7);
    });

    it('returns only the days within a 3-day Monday–Wednesday range', () => {
      component.selectedStartDate.set('2025-01-06');
      component.selectedEndDate.set('2025-01-08');
      const days = component.availableDays();
      expect(days.has('LUNES')).toBeTrue();
      expect(days.has('MARTES')).toBeTrue();
      expect(days.has('MIERCOLES')).toBeTrue();
      expect(days.has('JUEVES')).toBeFalse();
    });
  });

  describe('toggleDay / isDaySelected', () => {
    it('adds a day to the form control when it is not already selected', () => {
      component.scheduleForm.get('dias')?.setValue([]);
      component.toggleDay('LUNES');
      expect(component.isDaySelected('LUNES')).toBeTrue();
    });

    it('removes a day from the form control when it is already selected', () => {
      component.scheduleForm.get('dias')?.setValue(['LUNES', 'MARTES']);
      component.toggleDay('LUNES');
      expect(component.isDaySelected('LUNES')).toBeFalse();
      expect(component.isDaySelected('MARTES')).toBeTrue();
    });
  });

  it('normaliza la fecha del turno al editar para que el formulario muestre el día correcto', () => {
    component.initialData = {
      id: 42,
      fecha: '2026-07-30T00:00:00.000Z',
      diaSemana: 'JUEVES',
      horaInicio: '08:00:00',
      horaFin: '13:00:00'
    };

    expect(component.scheduleForm.get('fechaInicio')?.value).toBe('2026-07-30');
    expect(component.scheduleForm.get('fechaFin')?.value).toBe('2026-07-30');
    expect(component.scheduleForm.get('dias')?.value).toEqual(['JUEVES']);
  });
});

describe('ScheduleFormComponent - onSave business validations', () => {
  let component: ScheduleFormComponent;
  let fixture: ComponentFixture<ScheduleFormComponent>;
  let empleadoService: jasmine.SpyObj<EmpleadoService>;
  let messageService: MessageService;

  beforeEach(async () => {
    const companySpy = jasmine.createSpyObj('CompanyService', ['getCompany']);
    empleadoService = jasmine.createSpyObj('EmpleadoService', ['assignBulkSchedule', 'updateHorario']);
    companySpy.getCompany.and.returnValue(of({ data: null }));

    await TestBed.configureTestingModule({
      imports: [ScheduleFormComponent, HttpClientTestingModule],
      providers: [
        MessageService,
        ConfirmationService,
        { provide: CompanyService, useValue: companySpy },
        { provide: EmpleadoService, useValue: empleadoService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleFormComponent);
    component = fixture.componentInstance;
    messageService = TestBed.inject(MessageService);
    spyOn(messageService, 'add');
    component.employeeId = 1;
    fixture.detectChanges();
  });

  it('bloquea fecha fin anterior a fecha inicio', () => {
    component.scheduleForm.setValue({
      fechaInicio: '2026-07-10',
      fechaFin: '2026-07-09',
      horaInicio: '08:00',
      horaFin: '12:00',
      dias: ['VIERNES'],
      editMode: 'bulk',
    });

    component.onSave();

    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      summary: 'Rango invalido',
    }));
    expect(empleadoService.assignBulkSchedule).not.toHaveBeenCalled();
  });

  it('bloquea horario fuera del rango operativo de la clinica', () => {
    component.companyInfo.set({
      name: 'VargasVet',
      operatingHours: [{
        diaSemana: 'LUNES',
        isOpen: true,
        openingTime: '08:00:00',
        closingTime: '17:00:00',
      }],
    });
    component.scheduleForm.setValue({
      fechaInicio: '2026-07-06',
      fechaFin: '2026-07-06',
      horaInicio: '07:00',
      horaFin: '08:00',
      dias: ['LUNES'],
      editMode: 'bulk',
    });

    component.onSave();

    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'error',
      summary: 'Horario Fuera de Rango',
    }));
    expect(empleadoService.assignBulkSchedule).not.toHaveBeenCalled();
  });
});
