import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { VentanasComponent } from './ventanas.component';
import { MenuManagementService } from '../../../core/services/menu-management.service';
import { VentanaDTO } from '../../../models/menu/menu-management.model';
import { VistaDTO } from '../../../models/response/auth-login-response.model';

describe('VentanasComponent - estructura del menú', () => {
  let fixture: ComponentFixture<VentanasComponent>;
  let component: VentanasComponent;
  let servicio: jasmine.SpyObj<MenuManagementService>;

  const modulo = (id: number, nombre: string, orden: number, activo = true): VentanaDTO =>
    ({ id, codigo: nombre.toUpperCase(), nombre, orden, activo, grupo: nombre.toLowerCase(), presentacionDefault: 'GROUPED' });
  const vista = (id: number, codigo: string, nombre: string, ventanaId: number | null, orden: number, grupo = 'ADMIN'): VistaDTO =>
    ({ id, codigo, nombre, activo: true, orden, grupo, ventanaId, ventanaNombre: undefined } as VistaDTO);
  const respuesta = <T>(data: T) => of({ success: true, message: 'ok', data });
  const html = () => fixture.nativeElement as HTMLElement;
  const grupo = (clave: string) => component.displayGroups().find(g => g.key === clave)!;
  const nombres = (clave: string) => grupo(clave).items.map(v => v.codigo);

  const administracion = modulo(10, 'Administración', 1);
  const clinica = modulo(20, 'Clínica', 2);
  const vacio = modulo(30, 'Inventario', 3);

  async function crear(vistas: VistaDTO[], modulos: VentanaDTO[]) {
    servicio = jasmine.createSpyObj<MenuManagementService>('MenuManagementService',
      ['listarVistas', 'listarVentanas', 'reordenarVistas', 'actualizarVentana', 'crearVista', 'actualizarVista', 'eliminarVista']);
    servicio.listarVistas.and.returnValue(respuesta(vistas));
    servicio.listarVentanas.and.returnValue(respuesta(modulos));
    servicio.reordenarVistas.and.returnValue(respuesta(undefined as unknown as void));
    servicio.actualizarVentana.and.returnValue(respuesta(administracion));
    await TestBed.configureTestingModule({
      imports: [VentanasComponent],
      providers: [{ provide: MenuManagementService, useValue: servicio }],
    }).compileComponents();
    fixture = TestBed.createComponent(VentanasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const arrastre = (origen: string, destino: string, desde: number, hasta: number) => {
    const a = { id: origen };
    const b = origen === destino ? a : { id: destino };
    return { previousContainer: a, container: b, previousIndex: desde, currentIndex: hasta, item: { data: { groupKey: origen } } } as any;
  };

  beforeEach(async () => {
    await crear([
      vista(1, 'VISTA_ROLES', 'Roles', 10, 20),
      vista(2, 'VISTA_COMPANY', 'Mi Empresa', 10, 10),
      vista(3, 'VISTA_CLIENTES', 'Clientes', 20, 10),
      vista(4, 'VISTA_MASCOTAS', 'Mascotas', 20, 20),
      vista(5, 'VISTA_PROFILE', 'Mi perfil', null, 98),
    ], [clinica, administracion, vacio]);
  });

  describe('agrupación', () => {
    it('agrupa por módulo y no por el texto heredado del grupo', () => {
      const clientes = component.vistas().find(v => v.id === 3)!;
      expect(clientes.grupo).toBe('ADMIN');

      expect(nombres('20')).toContain('VISTA_CLIENTES');
      expect(nombres('10')).not.toContain('VISTA_CLIENTES');
    });

    it('muestra los módulos en su orden, los vacíos y al final las vistas sin módulo', () => {
      expect(component.displayGroups().map(g => g.label)).toEqual(['Administración', 'Clínica', 'Inventario', 'Sin módulo']);
      expect(grupo('30').items).toEqual([]);
      expect(nombres('__STANDALONE__')).toEqual(['VISTA_PROFILE']);
    });

    it('ordena las vistas de cada módulo por su posición guardada', () => {
      expect(nombres('10')).toEqual(['VISTA_COMPANY', 'VISTA_ROLES']);
    });

    it('con el buscador solo muestra los módulos que tienen coincidencias', () => {
      component.filterText.set('mascotas');

      expect(component.displayGroups().map(g => g.key)).toEqual(['20']);
    });

    it('un módulo inactivo se identifica como tal', () => {
      expect(modulo(40, 'Antiguo', 9, false).activo).toBeFalse();
    });
  });

  describe('mover vistas entre módulos', () => {
    it('al soltar una vista en otro módulo se guarda el módulo destino y la posición de todas', () => {
      component.onItemDrop(arrastre('20', '10', 0, 1), '10');

      const enviado = servicio.reordenarVistas.calls.mostRecent().args[0];
      expect(enviado.find(i => i.id === 3)).toEqual({ id: 3, orden: 20, ventanaId: 10, sinModulo: false });
      expect(enviado.filter(i => i.ventanaId === 10).map(i => i.id)).toEqual([2, 3, 1]);
      expect(enviado.filter(i => i.ventanaId === 20).map(i => i.id)).toEqual([4]);
    });

    it('la pantalla refleja el cambio de inmediato', () => {
      component.onItemDrop(arrastre('20', '10', 0, 0), '10');

      expect(nombres('10')[0]).toBe('VISTA_CLIENTES');
      expect(nombres('20')).toEqual(['VISTA_MASCOTAS']);
    });

    it('se puede soltar una vista en un módulo que está vacío', () => {
      component.onItemDrop(arrastre('20', '30', 0, 0), '30');

      const enviado = servicio.reordenarVistas.calls.mostRecent().args[0];
      expect(enviado.find(i => i.id === 3)).toEqual({ id: 3, orden: 10, ventanaId: 30, sinModulo: false });
      expect(nombres('30')).toEqual(['VISTA_CLIENTES']);
    });

    it('dejar una vista sin módulo lo indica de forma explícita', () => {
      component.onItemDrop(arrastre('20', '__STANDALONE__', 0, 0), '__STANDALONE__');

      const enviado = servicio.reordenarVistas.calls.mostRecent().args[0];
      expect(enviado.find(i => i.id === 3)).toEqual({ id: 3, orden: 10, ventanaId: null, sinModulo: true });
    });

    it('reordenar dentro del mismo módulo conserva el módulo y renumera las posiciones', () => {
      component.onItemDrop(arrastre('10', '10', 1, 0), '10');

      const enviado = servicio.reordenarVistas.calls.mostRecent().args[0];
      expect(enviado.filter(i => i.ventanaId === 10)).toEqual([
        { id: 1, orden: 10, ventanaId: 10, sinModulo: false },
        { id: 2, orden: 20, ventanaId: 10, sinModulo: false },
      ]);
    });

    it('no envía a las vistas de otros módulos con un módulo equivocado', () => {
      component.onItemDrop(arrastre('10', '10', 1, 0), '10');

      const enviado = servicio.reordenarVistas.calls.mostRecent().args[0];
      expect(enviado.find(i => i.id === 4)!.ventanaId).toBe(20);
      expect(enviado.find(i => i.id === 5)).toEqual({ id: 5, orden: 10, ventanaId: null, sinModulo: true });
    });

    it('si el servidor rechaza el cambio avisa y vuelve a cargar lo guardado', () => {
      servicio.reordenarVistas.and.returnValue(throwError(() => ({ error: { message: 'Ventana no encontrada' } })));
      servicio.listarVistas.calls.reset();

      component.onItemDrop(arrastre('20', '10', 0, 0), '10');

      expect(servicio.listarVistas).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBeFalse();
    });

    it('con el buscador activo no se permite arrastrar, para no renumerar solo una parte', () => {
      component.filterText.set('roles');
      expect(component.reordenHabilitado()).toBeFalse();

      component.onItemDrop(arrastre('10', '10', 0, 0), '10');

      expect(servicio.reordenarVistas).not.toHaveBeenCalled();
    });

    it('con las vistas inactivas ocultas tampoco se permite arrastrar', () => {
      component.showInactive.set(false);

      component.onItemDrop(arrastre('10', '10', 0, 0), '10');

      expect(servicio.reordenarVistas).not.toHaveBeenCalled();
    });
  });

  describe('módulos', () => {
    it('renombrar un módulo conserva el resto de sus datos', () => {
      component.editingGroupName.set('Gestión');

      component.confirmRenameGroup('10');

      expect(servicio.actualizarVentana).toHaveBeenCalledWith(10, jasmine.objectContaining({
        id: 10, codigo: 'ADMINISTRACIÓN', nombre: 'Gestión', orden: 1, activo: true
      }));
    });

    it('un nombre inválido no se envía', () => {
      component.editingGroupName.set('1');
      component.confirmRenameGroup('10');
      component.editingGroupName.set('   ');
      component.confirmRenameGroup('10');
      component.editingGroupName.set('Administración');
      component.confirmRenameGroup('10');

      expect(servicio.actualizarVentana).not.toHaveBeenCalled();
    });

    it('las vistas sin módulo no se pueden renombrar', () => {
      component.startRenameGroup(grupo('__STANDALONE__'));

      expect(component.editingGroupKey()).toBeNull();
    });

    it('agregar una vista desde un módulo la crea ya asignada a ese módulo', () => {
      component.addVistaToGroup('20');
      expect(component.vistaForm().ventanaId).toBe(20);

      component.addVistaToGroup('__STANDALONE__');
      expect(component.vistaForm().ventanaId).toBeNull();
    });
  });

  describe('pantalla', () => {
    it('habla de módulos y ya no ofrece un campo de grupo que no afecta al menú', () => {
      const texto = html().textContent?.replace(/\s+/g, ' ') ?? '';

      expect(texto).toContain('Módulos');
      expect(texto).toContain('Módulo (menú lateral)');
      expect(texto).not.toContain('Orden del grupo');
      expect(html().querySelector('datalist')).toBeNull();
    });
  });
});
