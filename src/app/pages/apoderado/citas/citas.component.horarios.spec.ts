import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CitasComponent } from './citas.component';

const horario = (diaSemana: string, horaInicio: string, horaFin: string, activo = true): any =>
  ({ id: Math.random(), diaSemana, horaInicio, horaFin, fecha: null, activo });

describe('CitasComponent (apoderado) — horario del profesional y huecos disponibles', () => {
  let component: CitasComponent;
  let fixture: ComponentFixture<CitasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CitasComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}), queryParamMap: of({ get: () => null }) } }
      ]
    })
      .overrideComponent(CitasComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CitasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('horario por día', () => {
    beforeEach(() => {
      component.horariosVeterinario.set([
        horario('MARTES', '14:00:00', '18:00:00'),
        horario('LUNES', '08:00:00', '12:00:00'),
        horario('LUNES', '14:00:00', '18:00:00'),
        horario('LUNES', '08:00:00', '12:00:00', false)
      ]);
    });

    it('agrupa por día, ordena los días de la semana y marca mañana o tarde', () => {
      expect(component.horariosPorDia()).toEqual([
        { diaSemana: 'LUNES', franjas: [{ label: '08:00–12:00', turno: 'manana' }, { label: '14:00–18:00', turno: 'tarde' }] },
        { diaSemana: 'MARTES', franjas: [{ label: '14:00–18:00', turno: 'tarde' }] }
      ]);
    });

    it('las lecturas repetidas devuelven los mismos objetos, de modo que la plantilla no recrea los días', () => {
      const primera = component.horariosPorDia();

      expect(component.horariosPorDia()).toBe(primera);
      expect(component.horariosPorDia()[0]).toBe(primera[0]);
    });

    it('al cambiar el profesional, el horario se actualiza', () => {
      component.horariosVeterinario.set([horario('VIERNES', '09:00:00', '10:00:00')]);

      expect(component.horariosPorDia().map(d => d.diaSemana)).toEqual(['VIERNES']);
    });

    it('sin horarios no hay días', () => {
      component.horariosVeterinario.set([]);

      expect(component.horariosPorDia()).toEqual([]);
    });
  });

  describe('huecos disponibles', () => {
    it('separa los de la mañana de los de la tarde a las 12:00', () => {
      component.availableSlots.set(['08:00', '11:30', '12:00', '15:00']);

      expect(component.slotsManana()).toEqual(['08:00', '11:30']);
      expect(component.slotsTarde()).toEqual(['12:00', '15:00']);
    });

    it('sin huecos, ambas listas están vacías', () => {
      component.availableSlots.set([]);

      expect(component.slotsManana()).toEqual([]);
      expect(component.slotsTarde()).toEqual([]);
    });

    it('las lecturas repetidas devuelven la misma lista', () => {
      component.availableSlots.set(['09:00', '16:00']);

      expect(component.slotsManana()).toBe(component.slotsManana());
    });
  });
});
