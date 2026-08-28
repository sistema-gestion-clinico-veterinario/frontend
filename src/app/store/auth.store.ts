import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { MenuItemDTO, MenuStructureDTO } from '../models/response/auth-login-response.model';

interface Enterprise {
  establishmentId: number;
  name: string;
  logoUrl?: string;
}

export type SessionStatus = 'uninitialized' | 'initializing' | 'authenticated' | 'anonymous';

interface AuthState {
  sessionStatus: SessionStatus;
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
  menu: (MenuItemDTO | MenuStructureDTO)[];
  originalMenu: (MenuItemDTO | MenuStructureDTO)[];
  simulatedRoleId: number | null;
  allowedRoutes: string[];
  loadingEnterprise: boolean;
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
  menu: (MenuItemDTO | MenuStructureDTO)[];
  originalMenu?: (MenuItemDTO | MenuStructureDTO)[];
  simulatedRoleId?: number | null;
}

const UI_PREFERENCES_STORAGE_KEY = 'auth_ui_preferences';
const LEGACY_AUTH_STORAGE_KEY = 'auth';

const createInitialState = (useStorage = true): AuthState => {
  let selectedEnterprise: Enterprise | null = null;
  if (useStorage && typeof window !== 'undefined') {
    // El formato anterior contenía identidad y permisos. Se elimina durante la
    // migración para impedir que vuelva a utilizarse accidentalmente.
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    const stored = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        selectedEnterprise = parsed.selectedEnterprise ?? null;
      } catch {
      }
    }
  }

  return {
    sessionStatus: useStorage ? 'uninitialized' : 'anonymous',
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
    selectedEnterprise,
    menu: [],
    originalMenu: [],
    simulatedRoleId: null,
    allowedRoutes: [],
    loadingEnterprise: false,
  };
};

const saveToStorage = (state: AuthState) => {
  if (typeof window !== 'undefined') {
    // Solo se persisten preferencias visuales. Identidad, roles, menús y rutas
    // se reconstruyen siempre desde la sesión HttpOnly validada por el backend.
    window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({
      selectedEnterprise: state.selectedEnterprise,
    }));
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
        sessionStatus: 'authenticated',
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
        loadingEnterprise: false,
      };
      patchState(store, state);
      saveToStorage(state);
    },

    beginSessionInitialization() {
      if (store.sessionStatus() === 'uninitialized') {
        patchState(store, { sessionStatus: 'initializing' });
      }
    },

    setToken(token: string) {
      patchState(store, { token });
      saveToStorage({ ...buildCurrentState(store), token } as unknown as AuthState);
    },

    setSelectedEnterprise(enterprise: Enterprise | null) {
      patchState(store, { selectedEnterprise: enterprise });
      const current = buildCurrentState(store);
      saveToStorage({ ...current, selectedEnterprise: enterprise });
    },

    setLoadingEnterprise(loadingEnterprise: boolean) {
      patchState(store, { loadingEnterprise });
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

    hasAccess(codigoVista: string, tipo: 'leer' | 'escribir' | 'modificar' | 'eliminar' = 'leer'): boolean {
      const ALIASES: Record<string, string> = {
        'APODERADOS':       'VISTA_CLIENTES',
        'EMPLEADOS':        'VISTA_EMPLEADOS',
        'MASCOTAS':         'VISTA_MASCOTAS',
        'COMPLEMENTARIO':   'VISTA_COMPLEMENTARIO',
        'EMPRESA':          'VISTA_COMPANY',
        'HORARIO':          'VISTA_HORARIOS',
        'HORARIOS':         'VISTA_HORARIOS',
        'HORARIO_MANAGE':   'VISTA_HORARIOS',
        'APODERADO_UPDATE': 'VISTA_CLIENTES',
        'ROLES':            'VISTA_ROLES',
        'VENTANAS':         'VISTA_VENTANAS',
        'PAGOS':            'VISTA_PAGOS',
        'AUDITORIA':        'VISTA_AUDITORIA_ADMIN',
        'RECETAS':          'VISTA_RECETAS',
        'MIS_RECETAS':      'VISTA_MIS_RECETAS',
        'HISTORIAS':        'VISTA_HISTORIAS',
      };
      const codigo = ALIASES[codigoVista] ?? codigoVista;

      const menu = store.menu() ?? [];
      const isMenuStructure = (obj: any): obj is MenuStructureDTO =>
        obj && typeof obj === 'object' && 'vistas' in obj && Array.isArray(obj.vistas);

      for (const item of menu) {
        const isMenuStructure = (obj: any): obj is MenuStructureDTO => {
          return obj && typeof obj === 'object' && 'vistas' in obj && Array.isArray(obj.vistas);
        };

        if (isMenuStructure(item)) {
          const vista = item.vistas.find(v => v.codigo === codigo);
          if (vista && vista[tipo as keyof MenuItemDTO]) {
            return true;
          }
        } else {
          const menuItem = item as MenuItemDTO;
          if (menuItem.codigo === codigo && menuItem[tipo as keyof MenuItemDTO]) {
            return true;
          }
        }
      }
      return false;
    },
    
    hasRouteAccess(routePattern: string): boolean {
      const roles = store.originalRoles()?.length ? store.originalRoles() : store.roles();

      // SUPER_ADMIN y ADMIN tienen acceso irrestricto a todas las rutas
      const isPrivileged = roles.some(r =>
        r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN' ||
        r === 'ROLE_ADMIN'       || r === 'ADMIN'
      );
      if (isPrivileged) return true;

      const normalized = normalizeRoute(routePattern);
      if (!normalized || normalized === 'profile' || normalized === 'password-change') return true;

      // Mapeo de alias de rutas a su ruta canónica en la base de datos
      const ROUTE_ALIASES: Record<string, string> = {
        'agenda': 'citas/agenda',
        'citas': 'citas/agenda',
        'empleado/agenda': 'citas/agenda',
        'empleado/citas': 'citas/agenda',
        'admin/citas': 'citas/agenda',
        'admin/citas/agenda': 'citas/agenda',
        'empleado/citas/agenda': 'citas/agenda',
        'empleado/mi-horario': 'mi-horario',
        'admin/empleados/horarios': 'empleados/horarios',
        'admin/mascotas': 'mascotas',
        'empleado/mascotas': 'mascotas',
        'admin/recetas': 'recetas',
        'empleado/recetas': 'recetas',
        'admin/historias-clinicas': 'historias-clinicas',
        'empleado/historias-clinicas': 'historias-clinicas',
      };

      const canonicalRoute = ROUTE_ALIASES[normalized] ?? normalized;

      // Acceso exacto o a una sub-ruta (ej. detalle/edición) de un módulo permitido
      if (store.allowedRoutes().some(r => canonicalRoute === r || canonicalRoute.startsWith(r + '/'))) {
        return true;
      }

      // Probar quitando prefijos de roles en caso de rutas relativas dinámicas
      const cleanPattern = stripPrefix(canonicalRoute);
      const cleanAllowed = store.allowedRoutes().map(r => stripPrefix(r));

      return cleanAllowed.some(r => cleanPattern === r || cleanPattern.startsWith(r + '/'));
    },

    isSuperAdmin(): boolean {
      return (store.originalRoles() ?? store.roles()).some(r =>
        r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN'
      );
    },

    isAdmin(): boolean {
      return (store.originalRoles() ?? store.roles()).some(r =>
        r === 'ROLE_SUPER_ADMIN' || r === 'SUPER_ADMIN' ||
        r === 'ROLE_ADMIN'       || r === 'ADMIN'
      );
    },

    logout() {
      patchState(store, createInitialState(false));
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(UI_PREFERENCES_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      }
    },
  }))
);


function buildCurrentState(store: any): AuthState {
  return {
    sessionStatus: store.sessionStatus(),
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
    loadingEnterprise: store.loadingEnterprise(),
  };
}

function extractAllowedRoutes(menuItems: (MenuItemDTO | MenuStructureDTO)[]): Set<string> {
  const routes = new Set<string>();
  for (const item of menuItems || []) {
    const isMenuStructure = (obj: any): obj is MenuStructureDTO => {
      return obj && typeof obj === 'object' && 'vistas' in obj && Array.isArray(obj.vistas);
    };

    if (isMenuStructure(item)) {
      for (const vista of item.vistas) {
        if ((vista.activo ?? true) && vista.leer !== false && vista.ruta) {
          routes.add(normalizeRoute(vista.ruta));
        }
      }
    } else {
      const menuItem = item as MenuItemDTO;
      if ((menuItem.activo ?? true) && menuItem.leer !== false && menuItem.ruta) {
        routes.add(normalizeRoute(menuItem.ruta));
      }
    }
  }
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

function stripPrefix(route: string): string {
  if (route.startsWith('admin/')) {
    return route.substring(6);
  }
  if (route.startsWith('empleado/')) {
    return route.substring(9);
  }
  if (route.startsWith('apoderado/')) {
    return route.substring(10);
  }
  return route;
}
