import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { HorarioEmpleadoResponse } from '../../../models/response/horario-empleado-response';
import { AgendaComponent } from './agenda.component';

const horario = (id: number, diaSemana: string, horaInicio: string, horaFin: string, activo = true, fecha: string | null = null): HorarioEmpleadoResponse =>
  ({ id, diaSemana, horaInicio, horaFin, fecha: fecha as string, activo });

describe('AgendaComponent — horario del veterinario elegido', () => {
  let component: AgendaComponent;
  let fixture: ComponentFixture<AgendaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']) },
        { provide: MessageService, useValue: { add: jasmine.createSpy('add') } },
        { provide: ConfirmationService, useValue: { confirm: jasmine.createSpy('confirm') } }
      ]
    })
      .overrideComponent(AgendaComponent, { set: { template: '', imports: [CommonModule, ReactiveFormsModule] } })
      .compileComponents();

    fixture = TestBed.createComponent(AgendaComponent);
    component = fixture.componentInstance;
  });

  it('los horarios activos excluyen los marcados como inactivos', () => {
    component.horariosVeterinario.set([
      horario(1, 'LUNES', '08:00:00', '12:00:00'),
      horario(2, 'MARTES', '08:00:00', '12:00:00', false),
      horario(3, 'MIERCOLES', '08:00:00', '12:00:00')
    ]);

    expect(component.horariosActivos().map(h => h.id)).toEqual([1, 3]);
  });

  it('el resumen agrupa por día y hora y conserva el orden de la semana', () => {
    component.horariosVeterinario.set([
      horario(1, 'MARTES', '09:00:00', '13:00:00'),
      horario(2, 'LUNES', '14:00:00', '18:00:00'),
      horario(3, 'LUNES', '08:00:00', '12:00:00')
    ]);

    const resumen = component.horariosResumen();

    expect(resumen.map(h => h.diaSemana + ' ' + h.horaInicio + '-' + h.horaFin)).toEqual([
      'LUNES 08:00-12:00', 'LUNES 14:00-18:00', 'MARTES 09:00-13:00'
    ]);
  });

  it('las lecturas repetidas devuelven la misma lista, de modo que la plantilla no recrea las filas', () => {
    component.horariosVeterinario.set([horario(1, 'LUNES', '08:00:00', '12:00:00')]);

    expect(component.horariosResumen()).toBe(component.horariosResumen());
    expect(component.horariosActivos()).toBe(component.horariosActivos());
  });

  it('al cambiar de veterinario, el resumen se actualiza', () => {
    component.horariosVeterinario.set([horario(1, 'LUNES', '08:00:00', '12:00:00')]);
    expect(component.horariosResumen().length).toBe(1);

    component.horariosVeterinario.set([horario(2, 'VIERNES', '10:00:00', '14:00:00'), horario(3, 'SABADO', '10:00:00', '14:00:00')]);

    expect(component.horariosResumen().map(h => h.diaSemana)).toEqual(['VIERNES', 'SABADO']);
  });

  it('sin horarios, el resumen está vacío', () => {
    component.horariosVeterinario.set([]);

    expect(component.horariosActivos()).toEqual([]);
    expect(component.horariosResumen()).toEqual([]);
  });
});
