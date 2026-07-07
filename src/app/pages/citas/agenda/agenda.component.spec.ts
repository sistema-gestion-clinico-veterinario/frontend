import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgendaComponent } from './agenda.component';
import { Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup } from '@angular/forms';

describe('AgendaComponent', () => {
  let component: AgendaComponent;
  let fixture: ComponentFixture<AgendaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']) },
        { provide: MessageService, useValue: { add: jasmine.createSpy('add') } },
        { provide: ConfirmationService, useValue: { confirm: jasmine.createSpy('confirm') } },
      ],
    })
      .overrideComponent(AgendaComponent, {
        set: { template: '', imports: [CommonModule, ReactiveFormsModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AgendaComponent);
    component = fixture.componentInstance;
  });

  describe('diasSemanaActual', () => {
    it('starts on Monday (day=1) when fechaBase is a Monday', () => {
      component.fechaBase.set(new Date(2025, 0, 6));
      const week = component.diasSemanaActual();
      expect(week.length).toBe(7);
      expect(week[0].getDay()).toBe(1);
    });

    it('rolls back to the previous Monday when fechaBase is a Sunday', () => {
      component.fechaBase.set(new Date(2025, 0, 12));
      const week = component.diasSemanaActual();
      expect(week[0].getDay()).toBe(1);
      expect(week[0].getDate()).toBe(6);
    });
  });

  describe('diasMesActual', () => {
    it('always returns exactly 42 calendar dates (6 full weeks)', () => {
      component.fechaBase.set(new Date(2025, 0, 1));
      expect(component.diasMesActual().length).toBe(42);
    });
  });

  describe('horariosValidator', () => {
    it('returns null when control value is null', () => {
      const fb = TestBed.inject(FormBuilder);
      const ctrl = fb.control(null);
      expect(component.horariosValidator(ctrl)).toBeNull();
    });

    it('returns null when esEmergencia is true (schedule check is skipped)', () => {
      component.citaForm.patchValue({ esEmergencia: true });
      const ctrl = component.citaForm.get('fechaHoraInicio')!;
      ctrl.patchValue(new Date('2025-07-05T10:00:00'), { emitEvent: false, onlySelf: true });
      expect(component.horariosValidator(ctrl)).toBeNull();
    });
  });
});
