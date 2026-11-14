import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { HorarioEmpleadoResponse } from '../../../models/response/horario-empleado-response';
import { MyScheduleComponent } from './my-schedule.component';

const horario = (id: number, diaSemana: string, horaInicio: string, horaFin: string, fecha: string | null = null): HorarioEmpleadoResponse =>
  ({ id, diaSemana, horaInicio, horaFin, fecha: fecha as string, activo: true });

type Pantalla = { horarios: HorarioEmpleadoResponse[]; printableWeeks: any[] };
const clase = MyScheduleComponent as unknown as Type<Pantalla>;

describe('MyScheduleComponent — semanas para imprimir', () => {
  let fixture: ComponentFixture<Pantalla>;
  let component: Pantalla;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [clase, HttpClientTestingModule],
      providers: [MessageService]
    })
      .overrideComponent(clase, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(clase);
    component = fixture.componentInstance;
  });

  it('sin horarios no hay semanas', () => {
    component.horarios = [];

    expect(component.printableWeeks).toEqual([]);
  });

  it('los horarios sin fecha forman la base semanal, con los siete días', () => {
    component.horarios = [horario(1, 'LUNES', '08:00:00', '12:00:00'), horario(2, 'LUNES', '14:00:00', '18:00:00')];

    const semanas = component.printableWeeks;

    expect(semanas.length).toBe(1);
    expect(semanas[0].isBase).toBeTrue();
    expect(semanas[0].days.map((d: any) => d.name)).toEqual(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
    expect(semanas[0].days[0].shifts.map((s: any) => s.timeRange)).toEqual(['08:00 - 12:00', '14:00 - 18:00']);
    expect(semanas[0].days[1].shifts).toEqual([]);
  });

  it('los horarios con fecha forman una semana por cada lunes, en orden', () => {
    component.horarios = [
      horario(1, 'MIERCOLES', '09:00:00', '13:00:00', '2026-11-25'),
      horario(2, 'MIERCOLES', '09:00:00', '13:00:00', '2026-11-18'),
      horario(3, 'JUEVES', '10:00:00', '12:00:00', '2026-11-19')
    ];

    const semanas = component.printableWeeks;

    expect(semanas.length).toBe(2);
    expect(semanas.every((s: any) => !s.isBase)).toBeTrue();
    expect(semanas[0].days[2].shifts.length).toBe(1);
    expect(semanas[0].days[3].shifts.length).toBe(1);
    expect(semanas[1].days[2].shifts.length).toBe(1);
    expect(semanas[0].subtitle).toContain('16');
    expect(semanas[1].subtitle).toContain('23');
  });

  it('la base semanal va antes que las semanas con fecha', () => {
    component.horarios = [horario(1, 'MIERCOLES', '09:00:00', '13:00:00', '2026-11-18'), horario(2, 'LUNES', '08:00:00', '12:00:00')];

    expect(component.printableWeeks.map((s: any) => s.isBase)).toEqual([true, false]);
  });

  it('las lecturas repetidas devuelven la misma lista, de modo que la plantilla no recrea la tabla', () => {
    component.horarios = [horario(1, 'LUNES', '08:00:00', '12:00:00'), horario(2, 'MIERCOLES', '09:00:00', '13:00:00', '2026-11-18')];

    const primera = component.printableWeeks;

    expect(component.printableWeeks).toBe(primera);
    expect(component.printableWeeks[0]).toBe(primera[0]);
  });

  it('al cargar otros horarios, las semanas se recalculan', () => {
    component.horarios = [horario(1, 'LUNES', '08:00:00', '12:00:00')];
    const antes = component.printableWeeks;

    component.horarios = [horario(2, 'VIERNES', '10:00:00', '14:00:00')];
    const despues = component.printableWeeks;

    expect(despues).not.toBe(antes);
    expect(despues[0].days[4].shifts.length).toBe(1);
    expect(despues[0].days[0].shifts.length).toBe(0);
  });
});
