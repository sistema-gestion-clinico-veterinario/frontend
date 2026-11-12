import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgendaComponent } from './agenda.component';
import { Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MascotaService } from '../../../core/services/mascota.service';
import { EmpleadoService } from '../../../core/services/empleado.service';

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

  describe('emergencias por servicio', () => {
    beforeEach(() => {
      spyOn(component.authStore, 'hasAccess').and.returnValue(true);
      component.serviciosConDetalle.set([
        { id: 10, nombre: 'Baño y Spa', permiteEmergencia: false },
        { id: 20, nombre: 'Consulta de emergencia', permiteEmergencia: true }
      ] as any);
    });

    it('no habilita emergencia para un servicio de grooming', () => {
      component.selectedServicioId.set(10);

      expect(component.canBookEmergency()).toBeFalse();
    });

    it('habilita emergencia para un servicio clínico configurado', () => {
      component.selectedServicioId.set(20);

      expect(component.canBookEmergency()).toBeTrue();
    });

    it('genera una hora inmediata que todavía es futura al enviarse', () => {
      const antes = Date.now();

      (component as any).setEmergencyDateTime();

      const fecha = component.citaForm.get('fechaCita')?.value;
      const hora = component.citaForm.get('horaCita')?.value;
      expect(new Date(`${fecha}T${hora}:00`).getTime()).toBeGreaterThan(antes + 60_000);
    });
  });

  describe('carga eficiente de catálogos', () => {
    it('carga los dueños al abrir el formulario, reutiliza el resultado y no carga las mascotas de toda la clínica', () => {
      const apoderados = TestBed.inject(ApoderadoService);
      const mascotas = TestBed.inject(MascotaService);
      const listarApoderados = spyOn(apoderados, 'listar').and.returnValue(
        of({ data: { content: [] } } as any)
      );
      const listarMascotas = spyOn(mascotas, 'listar').and.returnValue(
        of({ data: { content: [] } } as any)
      );

      component.openNew();
      component.openNew();

      expect(listarApoderados).toHaveBeenCalledTimes(1);
      expect(listarMascotas).not.toHaveBeenCalled();
    });

    it('al elegir un cliente pide solo sus mascotas activas, con una página dentro del límite del servidor', () => {
      const mascotas = TestBed.inject(MascotaService);
      const listarMascotas = spyOn(mascotas, 'listar').and.returnValue(
        of({ data: { content: [{ id: 5, nombreCompleto: 'Luna' }] } } as any)
      );

      component.onClienteChange({ label: 'Ana Torres', value: 9 });

      expect(listarMascotas.calls.mostRecent().args.slice(1)).toEqual([undefined, undefined, 0, 100, true, false, 9]);
      expect(component.filteredMascotas()).toEqual([{ label: 'Luna', value: 5 }]);
    });

    it('al editar una cita pide todas las mascotas del cliente, también las inactivas', () => {
      const mascotas = TestBed.inject(MascotaService);
      const listarMascotas = spyOn(mascotas, 'listar').and.returnValue(
        of({ data: { content: [{ id: 6, nombreCompleto: 'Rocky' }] } } as any)
      );

      component['cargarMascotasDelCliente'](9, false);

      expect(listarMascotas.calls.mostRecent().args.slice(1)).toEqual([undefined, undefined, 0, 100, undefined, false, 9]);
      expect(component.filteredMascotas()).toEqual([{ label: 'Rocky', value: 6 }]);
    });

    it('si falla la carga de mascotas deja la lista vacía', () => {
      const mascotas = TestBed.inject(MascotaService);
      spyOn(mascotas, 'listar').and.returnValue(throwError(() => new Error('fallo')));
      component.filteredMascotas.set([{ label: 'Vieja', value: 1 }]);

      component['cargarMascotasDelCliente'](9, true);

      expect(component.filteredMascotas()).toEqual([]);
    });

    it('obtiene empleados una sola vez y expone como veterinarios solo los habilitados', () => {
      const empleados = TestBed.inject(EmpleadoService);
      spyOn(empleados, 'listar').and.returnValue(of({
        data: {
          content: [
            { id: 1, nombre: 'Ana', apellido: 'Vet', activo: true, tiposEmpleado: ['Veterinario'], esVeterinario: true },
            { id: 2, nombre: 'Luis', apellido: 'Admin', activo: true, tiposEmpleado: ['ADMINISTRATIVO'] },
            { id: 3, nombre: 'Eva', apellido: 'Inactiva', activo: false, tiposEmpleado: ['Veterinario'], esVeterinario: true }
          ]
        }
      } as any));

      component.loadVeterinarios();

      expect(component.todosEmpleados().map(e => e.id)).toEqual([1, 2]);
      expect(component.veterinarios()).toEqual([{ label: 'Ana Vet', value: 1 }]);
    });
  });
});
