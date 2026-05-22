import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { MenuItemDTO } from '../models/response/auth-login-response.model';

interface Enterprise {
  establishmentId: number;
  name: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  roles: string[];
  assignedRoles: string[];
  originalRoles: string[];
  companyId: number | null;
  companyName: string | null;
  nombreCompleto: string | null;
  userType: string | null;
  empleadoId: number | null;
  passwordChanged: boolean;
  needsCompanySelection: boolean;
  selectedEnterprise: Enterprise | null;
  menu: MenuItemDTO[];
  originalMenu: MenuItemDTO[];
  simulatedRoleId: number | null;
  allowedRoutes: string[];
}

export interface AuthPayload {
  token: string | null;
  refreshToken: string | null;
  roles: string[];
  assignedRoles?: string[];
  originalRoles?: string[];
  companyId?: number | null;
  companyName?: string | null;
  nombreCompleto?: string | null;
  userType?: string | null;
  empleadoId?: number | null;
  passwordChanged: boolean;
  needsCompanySelection: boolean;
  selectedEnterprise?: Enterprise | null;
  menu: MenuItemDTO[];
  originalMenu?: MenuItemDTO[];
  simulatedRoleId?: number | null;
}

const createInitialState = (useStorage = true): AuthState => {
  if (useStorage && typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const menu = parsed.menu ?? [];
        return {
          ...parsed,
          simulatedRoleId: parsed.simulatedRoleId ?? null,
          originalMenu: parsed.originalMenu ?? parsed.menu ?? [],
          assignedRoles: parsed.assignedRoles ?? parsed.roles ?? [],
          originalRoles: parsed.originalRoles ?? parsed.roles ?? [],
          allowedRoutes: parsed.allowedRoutes ?? Array.from(extractAllowedRoutes(menu)),
        } as AuthState;
      } catch {
      }
    }
  }

  return {
    token: null,
    refreshToken: null,
    roles: [],
    assignedRoles: [],
    originalRoles: [],
    companyId: null,
    companyName: null,
    nombreCompleto: null,
    userType: null,
    empleadoId: null,
    passwordChanged: false,
    needsCompanySelection: false,
    selectedEnterprise: null,
    menu: [],
    originalMenu: [],
    simulatedRoleId: null,
    allowedRoutes: [],
  };
};

const saveToStorage = (state: AuthState) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('auth', JSON.stringify(state));
  }
};

const initialState: AuthState = createInitialState();

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setAuth(auth: AuthPayload) {
      const allowedRoutes = Array.from(extractAllowedRoutes(auth.menu));
      const state: AuthState = {
        token: auth.token,
        refreshToken: auth.refreshToken,
        roles: auth.roles,
        assignedRoles: auth.assignedRoles ?? auth.roles ?? [],
        originalRoles: auth.originalRoles ?? auth.roles ?? [],
        companyId: auth.companyId ?? null,
        companyName: auth.companyName ?? null,
        nombreCompleto: auth.nombreCompleto ?? null,
        userType: auth.userType ?? null,
        empleadoId: auth.empleadoId ?? null,
        passwordChanged: auth.passwordChanged,
        needsCompanySelection: auth.needsCompanySelection,
        selectedEnterprise: auth.selectedEnterprise ?? null,
        menu: auth.menu,
        originalMenu: auth.originalMenu ?? auth.menu ?? [],
        simulatedRoleId: auth.simulatedRoleId ?? null,
        allowedRoutes,
      };
      patchState(store, state);
      saveToStorage(state);
    },

    setToken(token: string) {
      patchState(store, { token });
      saveToStorage({ ...buildCurrentState(store), token } as unknown as AuthState);
    },

    setSelectedEnterprise(enterprise: Enterprise) {
      patchState(store, { selectedEnterprise: enterprise });
      const current = buildCurrentState(store);
      saveToStorage({ ...current, selectedEnterprise: enterprise });
    },

    setMenu(menu: MenuItemDTO[]) {
      const allowedRoutes = Array.from(extractAllowedRoutes(menu));
      patchState(store, { menu, originalMenu: menu, allowedRoutes });
      saveToStorage({ ...buildCurrentState(store), menu, originalMenu: menu, allowedRoutes });
    },

    simulateRole(roleId: number | null, roleName: string, menu: MenuItemDTO[]) {
      const origRoles = store.originalRoles().length > 0 ? store.originalRoles() : store.roles();
      const allowedRoutes = Array.from(extractAllowedRoutes(menu));
      patchState(store, {
        simulatedRoleId: roleId,
        roles: [roleName],
        menu,
        originalRoles: origRoles,
        allowedRoutes,
      });
      saveToStorage({ ...buildCurrentState(store), simulatedRoleId: roleId, roles: [roleName], menu, originalRoles: origRoles, allowedRoutes });
    },

    stopSimulation() {
      const origMenu = store.originalMenu();
      const origRoles = store.originalRoles().length > 0 ? store.originalRoles() : store.roles();
      const allowedRoutes = Array.from(extractAllowedRoutes(origMenu));
      patchState(store, {
        simulatedRoleId: null,
        roles: origRoles,
        menu: origMenu,
        allowedRoutes,
      });
      saveToStorage({ ...buildCurrentState(store), simulatedRoleId: null, roles: origRoles, menu: origMenu, allowedRoutes });
    },

    hasAccess(codigoVentana: string, tipo: 'leer' | 'escribir' | 'modificar' | 'eliminar' = 'leer'): boolean {
      const menu = store.menu() ?? [];
      return buscarAccesoEnArbol(menu, codigoVentana, tipo);
    },

    hasRouteAccess(routePattern: string): boolean {
      const superAdmin = (store.originalRoles() ?? store.roles()).some(r =>
        r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN'
      );
      if (superAdmin) return true;

      const normalized = normalizeRoute(routePattern);
      if (!normalized || normalized === 'profile' || normalized === 'password-change') return true;

      return store.allowedRoutes().includes(normalized);
    },

    isSuperAdmin(): boolean {
      return (store.originalRoles() ?? store.roles()).some(r =>
        r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN'
      );
    },

    logout() {
      patchState(store, createInitialState(false));
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('auth');
      }
    },
  }))
);

function buscarAccesoEnArbol(
  items: MenuItemDTO[],
  codigo: string,
  tipo: 'leer' | 'escribir' | 'modificar' | 'eliminar'
): boolean {
  for (const item of items) {
    if (item.codigo === codigo) return item[tipo];
    if (item.hijos?.length) {
      const found = buscarAccesoEnArbol(item.hijos, codigo, tipo);
      if (found) return true;
    }
  }
  return false;
}

function buildCurrentState(store: any): AuthState {
  return {
    token: store.token(),
    refreshToken: store.refreshToken(),
    roles: store.roles(),
    assignedRoles: store.assignedRoles(),
    originalRoles: store.originalRoles(),
    companyId: store.companyId(),
    companyName: store.companyName(),
    nombreCompleto: store.nombreCompleto(),
    userType: store.userType(),
    empleadoId: store.empleadoId(),
    passwordChanged: store.passwordChanged(),
    needsCompanySelection: store.needsCompanySelection(),
    selectedEnterprise: store.selectedEnterprise(),
    menu: store.menu(),
    originalMenu: store.originalMenu(),
    simulatedRoleId: store.simulatedRoleId(),
    allowedRoutes: store.allowedRoutes(),
  };
}

function extractAllowedRoutes(menuItems: MenuItemDTO[]): Set<string> {
  const routes = new Set<string>();

  function traverse(items: MenuItemDTO[]) {
    for (const item of items) {
      if (item.ruta) {
        routes.add(normalizeRoute(item.ruta));
      }
      if (item.vistas) {
        for (const vista of item.vistas) {
          if (vista.ruta && vista.activo) {
            routes.add(normalizeRoute(vista.ruta));
          }
        }
      }
      if (item.hijos) {
        traverse(item.hijos);
      }
    }
  }

  traverse(menuItems || []);
  return routes;
}

function normalizeRoute(route: string): string {
  let r = route.trim();
  if (r.startsWith('/')) {
    r = r.substring(1);
  }
  if (r.endsWith('/')) {
    r = r.substring(0, r.length - 1);
  }
  return r.toLowerCase();
}
