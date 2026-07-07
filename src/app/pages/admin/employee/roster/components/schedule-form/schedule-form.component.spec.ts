import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduleFormComponent } from './schedule-form.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CompanyService } from '../../../../../../core/services/company.service';
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
});
