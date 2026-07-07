import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { MenuItemDTO, MenuStructureDTO } from '../models/response/auth-login-response.model';

const cleanAuth = {
  token: null as null,
  refreshToken: null as null,
  roles: [] as string[],
  menu: [] as (MenuItemDTO | MenuStructureDTO)[],
  passwordChanged: false,
  needsCompanySelection: false,
};

function flatItem(codigo: string, overrides: Partial<MenuItemDTO> = {}): MenuItemDTO {
  return {
    id: 1, codigo, nombre: codigo,
    activo: true, leer: true, escribir: false, modificar: false, eliminar: false,
    ruta: `/${codigo.toLowerCase()}`,
    ...overrides,
  } as MenuItemDTO;
}

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(AuthStore);
    store.logout();
  });

  describe('hasAccess – flat menu item', () => {
    it('returns true when flat item has the requested permission', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_EMPLEADO'], menu: [flatItem('VISTA_MASCOTAS')] });
      expect(store.hasAccess('VISTA_MASCOTAS', 'leer')).toBeTrue();
    });

    it('returns false when the item is not present in the menu', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_EMPLEADO'], menu: [] });
      expect(store.hasAccess('VISTA_MASCOTAS', 'leer')).toBeFalse();
    });
  });

  describe('hasAccess – alias resolution', () => {
    it('resolves HISTORIAS alias to VISTA_HISTORIAS before searching', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_EMPLEADO'], menu: [flatItem('VISTA_HISTORIAS')] });
      expect(store.hasAccess('HISTORIAS', 'leer')).toBeTrue();
    });
  });

  describe('hasAccess – MenuStructureDTO', () => {
    it('finds a vista nested inside a MenuStructureDTO group', () => {
      const group: MenuStructureDTO = {
        ventanaNombre: 'Gestión', orden: 1,
        vistas: [flatItem('VISTA_EMPLEADOS', { escribir: true })],
      };
      store.setAuth({ ...cleanAuth, roles: ['ROLE_EMPLEADO'], menu: [group] });
      expect(store.hasAccess('VISTA_EMPLEADOS', 'escribir')).toBeTrue();
    });
  });

  describe('hasRouteAccess', () => {
    it('returns true unconditionally for ROLE_SUPER_ADMIN', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_SUPER_ADMIN'], menu: [] });
      expect(store.hasRouteAccess('cualquier/ruta')).toBeTrue();
    });

    it('normalizes a route with leading and trailing slashes before matching', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_EMPLEADO'], menu: [flatItem('VISTA_MASCOTAS', { ruta: '/mascotas' })] });
      expect(store.hasRouteAccess('/mascotas/')).toBeTrue();
    });

    it('resolves the alias admin/mascotas → mascotas before checking allowedRoutes', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_EMPLEADO'], menu: [flatItem('VISTA_MASCOTAS', { ruta: '/mascotas' })] });
      expect(store.hasRouteAccess('admin/mascotas')).toBeTrue();
    });
  });

  describe('isSuperAdmin / isAdmin', () => {
    it('isSuperAdmin returns true for ROLE_SUPER_ADMIN', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_SUPER_ADMIN'], menu: [] });
      expect(store.isSuperAdmin()).toBeTrue();
    });

    it('isAdmin returns true for ROLE_ADMIN', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_ADMIN'], menu: [] });
      expect(store.isAdmin()).toBeTrue();
    });

    it('isSuperAdmin returns false for plain ROLE_ADMIN', () => {
      store.setAuth({ ...cleanAuth, roles: ['ROLE_ADMIN'], menu: [] });
      expect(store.isSuperAdmin()).toBeFalse();
    });
  });
});
