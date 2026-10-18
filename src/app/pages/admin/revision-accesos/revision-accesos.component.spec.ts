import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RevisionAccesosComponent } from './revision-accesos.component';
import {
  AccessReviewItem,
  AccessReviewOverview
} from '../../../models/access-review/access-review.model';
import { AccessReviewService } from '../../../core/services/access-review.service';
import { AuthStore } from '../../../store/auth.store';

function acceso(assignmentId: number, nombre: string): AccessReviewItem {
  return {
    assignmentId,
    usuarioId: assignmentId + 100,
    nombre,
    email: `${nombre.toLowerCase()}@clinica.test`,
    roleId: assignmentId,
    roleName: 'Administrador',
    reasons: ['Administrador de la empresa'],
    lastActivity: null,
    assignedAt: null
  };
}

const respuesta = <T>(data: T) => of({ success: true, message: '', data });

describe('RevisionAccesosComponent', () => {
  let fixture: ComponentFixture<RevisionAccesosComponent>;
  let component: RevisionAccesosComponent;
  let servicio: jasmine.SpyObj<AccessReviewService>;

  const sinRevisiones: AccessReviewOverview = {
    intervalDays: 90,
    overdue: true,
    nextDueAt: null,
    lastReview: null,
    items: [acceso(1, 'Ana'), acceso(2, 'Beto')]
  };

  function crear(puedeModificar = true): void {
    servicio = jasmine.createSpyObj<AccessReviewService>('AccessReviewService', [
      'obtener',
      'registrar',
      'historial',
      'detalle'
    ]);
    servicio.obtener.and.returnValue(respuesta(sinRevisiones));
    servicio.historial.and.returnValue(respuesta([]));
    servicio.registrar.and.returnValue(
      respuesta({
        id: 1,
        performedAt: '2026-10-12T10:00:00',
        performedByEmail: 'admin@clinica.test',
        reviewedCount: 2,
        keptCount: 1,
        revokedCount: 1,
        notes: null
      })
    );

    TestBed.configureTestingModule({
      imports: [RevisionAccesosComponent],
      providers: [provideRouter([]), { provide: AccessReviewService, useValue: servicio }]
    });
    spyOn(TestBed.inject(AuthStore), 'hasAccess').and.callFake(
      (codigo: string, tipo: string = 'leer') => codigo === 'VISTA_ROLES' && (tipo === 'leer' || puedeModificar)
    );
    fixture = TestBed.createComponent(RevisionAccesosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('avisa cuando todavía no se registró ninguna revisión', () => {
    crear();
    expect(fixture.nativeElement.querySelector('[data-testid="estado-revision"]').textContent).toContain(
      'Aún no se ha registrado ninguna revisión'
    );
  });

  it('no permite registrar hasta decidir sobre todos los accesos', () => {
    crear();
    const [ana, beto] = component.items();
    expect(component.listo()).toBeFalse();

    component.decidir(ana, 'KEEP');
    expect(component.pendientes()).toBe(1);
    expect(component.listo()).toBeFalse();

    component.decidir(beto, 'KEEP');
    expect(component.listo()).toBeTrue();
  });

  it('exige el motivo para retirar un acceso', () => {
    crear();
    const [ana, beto] = component.items();
    component.decidir(ana, 'KEEP');
    component.decidir(beto, 'REVOKE');
    expect(component.faltanMotivos()).toBeTrue();
    expect(component.listo()).toBeFalse();

    component.motivo(beto, 'Cambió de puesto');
    expect(component.listo()).toBeTrue();
  });

  it('envía las decisiones y las observaciones al registrar', () => {
    crear();
    const [ana, beto] = component.items();
    component.decidir(ana, 'KEEP');
    component.decidir(beto, 'REVOKE');
    component.motivo(beto, ' Cambió de puesto ');
    component.notas.set('Revisión trimestral');

    component.registrar();

    expect(servicio.registrar).toHaveBeenCalledWith(
      [
        { assignmentId: 1, decision: 'KEEP', comment: undefined },
        { assignmentId: 2, decision: 'REVOKE', comment: 'Cambió de puesto' }
      ],
      'Revisión trimestral',
      null
    );
  });

  it('pide confirmación antes de retirar accesos y registra directo si solo se mantienen', () => {
    crear();
    const [ana, beto] = component.items();
    component.decidir(ana, 'KEEP');
    component.decidir(beto, 'REVOKE');
    component.motivo(beto, 'Ya no trabaja aquí');

    component.solicitarRegistro();
    expect(component.confirmando()).toBeTrue();
    expect(servicio.registrar).not.toHaveBeenCalled();

    component.decidir(beto, 'KEEP');
    component.solicitarRegistro();
    expect(servicio.registrar).toHaveBeenCalledTimes(1);
  });

  it('no ofrece decisiones a quien solo puede consultar', () => {
    crear(false);
    expect(fixture.nativeElement.textContent).not.toContain('Mantener');
    expect(fixture.nativeElement.textContent).not.toContain('Registrar revisión');
  });

  describe('presentación', () => {
    it('agrupa en una sola tarjeta los roles de la misma persona', () => {
      crear();
      const mismaPersona = { ...acceso(3, 'Ana'), usuarioId: 101, roleName: 'ROLE_VETERINARIO' };
      component.overview.set({ ...sinRevisiones, items: [acceso(1, 'Ana'), mismaPersona, acceso(2, 'Beto')] });

      const grupos = component.grupos();

      expect(grupos.length).toBe(2);
      expect(grupos[0].accesos.map(a => a.assignmentId)).toEqual([1, 3]);
    });

    it('muestra el nombre del rol sin el prefijo técnico', () => {
      crear();
      expect(component.rolLegible('ROLE_VETERINARIO')).toBe('Veterinario');
      expect(component.rolLegible('ROLE_JEFE_DE_CAJA')).toBe('Jefe de caja');
    });

    it('mantener los pendientes no cambia lo ya decidido y completa el avance', () => {
      crear();
      const [ana, beto] = component.items();
      component.decidir(ana, 'REVOKE');
      component.motivo(ana, 'Ya no trabaja aquí');

      component.mantenerPendientes();

      expect(component.decisionDe(ana)?.decision).toBe('REVOKE');
      expect(component.decisionDe(beto)?.decision).toBe('KEEP');
      expect(component.pendientes()).toBe(0);
      expect(component.avance()).toBe(100);
    });

    it('calcula las iniciales para el avatar', () => {
      crear();
      expect(component.iniciales('Felipe Alva Vargas')).toBe('FA');
      expect(component.iniciales('Ana')).toBe('A');
    });
  });

  describe('lista de accesos', () => {
    const texto = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    const contador = (id: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`)?.textContent?.trim();

    it('muestra cuántos accesos faltan por decidir, cuántos se mantienen y cuántos se retiran', () => {
      crear();
      const [ana, beto] = component.items();
      expect(contador('contador-pendientes')).toBe('2');

      component.decidir(ana, 'KEEP');
      component.decidir(beto, 'REVOKE');
      fixture.detectChanges();

      expect(contador('contador-pendientes')).toBe('0');
      expect(contador('contador-mantenidos')).toBe('1');
      expect(contador('contador-retiros')).toBe('1');
    });

    it('dice con palabras qué pasará con cada acceso', () => {
      crear();
      const [ana, beto] = component.items();
      expect(texto()).toContain('Sin decidir');

      component.decidir(ana, 'KEEP');
      component.decidir(beto, 'REVOKE');
      fixture.detectChanges();

      expect(texto()).toContain('Conservará el acceso');
      expect(texto()).toContain('Perderá el acceso');
      expect(component.estadoDeLaDecision(ana)).toBe('KEEP');
    });

    it('el filtro «Por decidir» oculta lo que ya tiene decisión', () => {
      crear();
      const [ana] = component.items();
      component.decidir(ana, 'KEEP');

      component.cambiarFiltro('PENDIENTES');
      expect(component.gruposVisibles().length).toBe(1);
      expect(component.gruposVisibles()[0].accesos[0].nombre).toBe('Beto');

      component.cambiarFiltro('TODOS');
      expect(component.gruposVisibles().length).toBe(2);
    });

    it('cuando no queda nada por decidir lo explica en lugar de dejar la lista vacía', () => {
      crear();
      component.mantenerPendientes();
      component.cambiarFiltro('PENDIENTES');
      fixture.detectChanges();

      expect(texto()).toContain('No quedan accesos por decidir');
    });

    it('no repite en cada rol el aviso de que la persona tiene varios roles', () => {
      crear();
      const item = { ...acceso(1, 'Ana'), reasons: ['Administrador de la empresa', 'Tiene 2 roles de personal en la empresa'] };

      expect(component.motivosDelAcceso(item)).toEqual(['Administrador de la empresa']);
    });

    it('el campo del motivo solo aparece al retirar un acceso', () => {
      crear();
      const [ana] = component.items();
      const root = fixture.nativeElement as HTMLElement;

      component.decidir(ana, 'KEEP');
      fixture.detectChanges();
      expect(root.querySelector('input[id^="motivo-"]')).toBeNull();

      component.decidir(ana, 'REVOKE');
      fixture.detectChanges();
      expect(root.querySelector('input[id^="motivo-"]')).not.toBeNull();
    });
  });
});
