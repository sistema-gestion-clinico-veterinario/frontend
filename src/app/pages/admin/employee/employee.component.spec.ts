import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeComponent } from './employee.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

describe('EmployeeComponent', () => {
  let component: EmployeeComponent;
  let fixture: ComponentFixture<EmployeeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeComponent, HttpClientTestingModule],
    })
    .overrideComponent(EmployeeComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('suspender, dar de baja y reactivar', () => {
    let cambiarEstado: jasmine.Spy;
    const persona = (activo: boolean, tipoInactividad?: 'SUSPENSION' | 'BAJA') =>
      ({ id: 5, nombre: 'Ana', apellido: 'Torres', activo, tipoInactividad }) as any;

    beforeEach(() => {
      cambiarEstado = spyOn((component as any).empleadoService, 'cambiarEstado').and.returnValue(of({ success: true }));
      spyOn(component, 'loadEmployees');
    });

    it('suspender pide un motivo opcional y envía el tipo SUSPENSION con el motivo sin espacios sobrantes', () => {
      component.changeStatus(persona(true), 'SUSPENSION');

      expect(component.confirmDialog()?.askReason).toBeTrue();
      component.confirmReason.set('  Licencia médica  ');
      component.confirmAction();

      expect(cambiarEstado).toHaveBeenCalledWith(5, false, { tipo: 'SUSPENSION', reason: 'Licencia médica' });
    });

    it('dar de baja envía el tipo BAJA y, sin motivo, no envía motivo', () => {
      component.changeStatus(persona(true), 'BAJA');
      component.confirmReason.set('   ');
      component.confirmAction();

      expect(cambiarEstado).toHaveBeenCalledWith(5, false, { tipo: 'BAJA', reason: undefined });
    });

    it('reactivar no pide motivo y no envía tipo', () => {
      component.changeStatus(persona(false, 'BAJA'), 'REACTIVAR');

      expect(component.confirmDialog()?.askReason).toBeFalse();
      component.confirmAction();

      expect(cambiarEstado).toHaveBeenCalledWith(5, true, { tipo: undefined, reason: undefined });
    });

    it('el diálogo explica la acción elegida', () => {
      component.changeStatus(persona(true), 'SUSPENSION');
      expect(component.confirmDialog()?.title).toBe('Suspender');
      expect(component.confirmDialog()?.message).toContain('mientras dure la suspensión');

      component.changeStatus(persona(true), 'BAJA');
      expect(component.confirmDialog()?.title).toBe('Dar de baja');
    });

    it('un motivo escrito en un diálogo anterior no se arrastra al siguiente', () => {
      component.changeStatus(persona(true), 'SUSPENSION');
      component.confirmReason.set('Motivo viejo');
      component.cancelConfirm();

      component.changeStatus(persona(true), 'BAJA');

      expect(component.confirmReason()).toBe('');
    });

    it('cancelar no cambia el estado', () => {
      component.changeStatus(persona(true), 'BAJA');
      component.cancelConfirm();

      expect(cambiarEstado).not.toHaveBeenCalled();
      expect(component.confirmDialog()).toBeNull();
    });

    it('al resolver las citas pendientes se reintenta la misma acción con el mismo motivo', () => {
      cambiarEstado.and.returnValues(
        throwError(() => ({ error: { message: 'No se puede desactivar un empleado con citas programadas vigentes' } })),
        of({ success: true }));
      component.changeStatus(persona(true), 'SUSPENSION');
      component.confirmReason.set('Cambio de sede');
      component.confirmAction();

      component.onConflictsResolved();

      expect(cambiarEstado.calls.mostRecent().args).toEqual([5, false, { tipo: 'SUSPENSION', reason: 'Cambio de sede' }]);
    });

    describe('menú de acciones', () => {
      const etiquetas = (empleado: any) => component.employeeActionItems(empleado).map(item => item.label);

      beforeEach(() => spyOn((component as any).authStore, 'hasAccess').and.returnValue(true));

      it('una persona activa se puede suspender o dar de baja, pero no reactivar', () => {
        const items = etiquetas(persona(true));

        expect(items).toContain('Suspender');
        expect(items).toContain('Dar de baja');
        expect(items).not.toContain('Reactivar');
      });

      it('una suspendida puede pasar a baja o reactivarse', () => {
        const items = etiquetas(persona(false, 'SUSPENSION'));

        expect(items).not.toContain('Suspender');
        expect(items).toContain('Dar de baja');
        expect(items).toContain('Reactivar');
      });

      it('ya no hay una acción "Eliminar": la clínica conserva los registros y la salida es la baja', () => {
        for (const empleado of [persona(true), persona(false, 'SUSPENSION'), persona(false, 'BAJA')]) {
          expect(etiquetas(empleado)).not.toContain('Eliminar');
        }
      });

      it('una dada de baja solo se reactiva', () => {
        const items = etiquetas(persona(false, 'BAJA'));

        expect(items).not.toContain('Suspender');
        expect(items).not.toContain('Dar de baja');
        expect(items).toContain('Reactivar');
      });
    });

    it('si la persona dejó una caja abierta lo avisa para que un administrador la cierre', () => {
      cambiarEstado.and.returnValue(of({ success: true, data: ['Mostrador 1'] }));
      const toast = spyOn((component as any).messageService, 'add');

      component.changeStatus(persona(true), 'BAJA');
      component.confirmAction();

      expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({
        severity: 'warn', summary: 'Caja abierta',
        detail: jasmine.stringMatching(/Ana Torres.*Mostrador 1.*administrador debe cerrarla/)
      }));
    });

    it('si no dejó ninguna caja abierta no muestra ese aviso', () => {
      cambiarEstado.and.returnValue(of({ success: true, data: [] }));
      const toast = spyOn((component as any).messageService, 'add');

      component.changeStatus(persona(true), 'BAJA');
      component.confirmAction();

      expect(toast).toHaveBeenCalledTimes(1);
    });

    it('la etiqueta distingue suspendido de dado de baja', () => {
      expect(component.statusLabel(persona(true))).toBe('Activo');
      expect(component.statusLabel(persona(false, 'SUSPENSION'))).toBe('Suspendido');
      expect(component.statusLabel(persona(false, 'BAJA'))).toBe('De baja');
    });
  });

  describe('restablecer acceso', () => {
    let solicitar: jasmine.Spy;
    let aviso: jasmine.Spy;

    beforeEach(() => {
      solicitar = spyOn((component as any).empleadoService, 'requestPasswordReset').and.returnValue(of({ success: true }));
      aviso = spyOn((component as any).messageService, 'add');
      component.selectedEmployeeForReset.set({ userId: 10, email: 'ana@example.test', nombre: 'Ana' } as any);
      component.showPasswordResetModal.set(true);
    });

    it('envía la clínica seleccionada para que la plataforma indique a cuál pertenece la persona', () => {
      spyOnProperty(component, 'activeCompanyId', 'get').and.returnValue(7);

      component.submitPasswordReset();

      expect(solicitar).toHaveBeenCalledWith(10, 'ana@example.test', 7);
    });

    it('avisa con palabras claras que el correo va en camino y qué hacer si no llega', () => {
      component.submitPasswordReset();

      const mensaje = aviso.calls.mostRecent().args[0];
      expect(mensaje.severity).toBe('success');
      expect(mensaje.detail).toContain('Estamos enviando a Ana un correo');
      expect(mensaje.detail).toContain('Si no le llega en unos minutos');
      expect(component.showPasswordResetModal()).toBeFalse();
    });

    it('si falla, muestra el motivo que devuelve el servidor y deja el cuadro abierto', () => {
      solicitar.and.returnValue(throwError(() => ({ error: { message: 'La cuenta todavía no está habilitada' } })));

      component.submitPasswordReset();

      expect(aviso.calls.mostRecent().args[0].detail).toBe('La cuenta todavía no está habilitada');
      expect(component.showPasswordResetModal()).toBeTrue();
      expect(component.requestingPasswordReset()).toBeFalse();
    });
  });
});
