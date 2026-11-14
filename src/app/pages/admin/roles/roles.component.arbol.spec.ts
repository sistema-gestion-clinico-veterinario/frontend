import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { RolVentanaPermiso } from '../../../models/role/role-permission.model';
import { RolesComponent } from './roles.component';

const ventana = (ventanaId: number, codigo: string, parentId: number | null, parentCodigo: string | null): RolVentanaPermiso => ({
  ventanaId, codigo, nombre: codigo, icono: null, parentId, parentCodigo,
  leer: true, escribir: false, modificar: false, eliminar: false, dataScope: 'COMPANY', visibleMenu: true
});

describe('RolesComponent — árbol de ventanas', () => {
  let component: RolesComponent;
  let fixture: ComponentFixture<RolesComponent>;

  const lista = [
    ventana(1, 'ADMIN', null, null),
    ventana(2, 'ADMIN_ROLES', 1, 'ADMIN'),
    ventana(3, 'ADMIN_EMPLEADOS', 1, 'ADMIN'),
    ventana(4, 'CLINICA', null, null),
    ventana(5, 'CLINICA_HISTORIAS', 4, 'CLINICA'),
    ventana(6, 'SUELTA', 99, 'NO_EXISTE')
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolesComponent, HttpClientTestingModule],
      providers: [MessageService, provideRouter([])]
    })
      .overrideComponent(RolesComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(RolesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.ventanaPermisos.set(lista);
  });

  it('las ventanas raíz son las que no tienen padre, en su orden', () => {
    expect(component.rootVentanas().map(v => v.codigo)).toEqual(['ADMIN', 'CLINICA']);
  });

  it('los hijos de cada grupo coinciden con filtrar la lista por el código del padre', () => {
    for (const codigo of ['ADMIN', 'CLINICA', 'NO_EXISTE', 'OTRO']) {
      expect(component.childrenOf(codigo)).toEqual(lista.filter(v => v.parentCodigo === codigo));
    }
    expect(component.childrenOf('ADMIN').map(v => v.codigo)).toEqual(['ADMIN_ROLES', 'ADMIN_EMPLEADOS']);
  });

  it('un grupo sin hijos devuelve una lista vacía', () => {
    expect(component.childrenOf('CLINICA_HISTORIAS')).toEqual([]);
  });

  it('las lecturas repetidas devuelven la misma lista, sin recalcular', () => {
    expect(component.childrenOf('ADMIN')).toBe(component.childrenOf('ADMIN'));
    expect(component.rootVentanas()).toBe(component.rootVentanas());
    expect(component.childrenOf('SIN_HIJOS')).toBe(component.childrenOf('OTRO_SIN_HIJOS'));
  });

  it('al cambiar un permiso, el árbol refleja la ventana modificada', () => {
    component.togglePermiso(lista[1], 'escribir');

    const rolesVentana = component.childrenOf('ADMIN').find(v => v.codigo === 'ADMIN_ROLES');
    expect(rolesVentana?.escribir).toBeTrue();
    expect(component.childrenOf('ADMIN').length).toBe(2);
  });

  it('al cargar otro rol, el árbol se reemplaza por completo', () => {
    component.ventanaPermisos.set([ventana(10, 'OTRO', null, null), ventana(11, 'OTRO_HIJO', 10, 'OTRO')]);

    expect(component.rootVentanas().map(v => v.codigo)).toEqual(['OTRO']);
    expect(component.childrenOf('ADMIN')).toEqual([]);
    expect(component.childrenOf('OTRO').map(v => v.codigo)).toEqual(['OTRO_HIJO']);
  });
});
