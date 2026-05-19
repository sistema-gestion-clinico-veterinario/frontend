import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { Menu } from '../models/response/auth-login-response.model';


interface Enterprise {
  establishmentId: number;
  name: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  roles: string[];
  permissions: string[];
  companyId: number | null;
  companyName: string | null;
  nombreCompleto: string | null;
  userType: string | null;
  empleadoId: number | null;
  passwordChanged: boolean;
  needsCompanySelection: boolean;
  selectedEnterprise: Enterprise | null;
  menu: Menu[];
  simulatedRoleId: number | null;
  originalMenu: Menu[];
  originalPermissions: string[];
  assignedRoles: string[];
  originalRoles: string[];
}

export interface AuthPayload {
  token: string | null;
  refreshToken: string | null;
  roles: string[];
  permissions: string[];
  companyId?: number | null;
  companyName?: string | null;
  nombreCompleto?: string | null;
  userType?: string | null;
  empleadoId?: number | null;
  passwordChanged: boolean;
  needsCompanySelection: boolean;
  selectedEnterprise?: Enterprise | null;
  menu: Menu[];
  simulatedRoleId?: number | null;
  originalMenu?: Menu[];
  originalPermissions?: string[];
  assignedRoles?: string[];
  originalRoles?: string[];
}

const createInitialState = (useStorage = true): AuthState => {
  if (useStorage && typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          simulatedRoleId: parsed.simulatedRoleId ?? null,
          originalMenu: parsed.originalMenu ?? parsed.menu ?? [],
          originalPermissions: parsed.originalPermissions ?? parsed.permissions ?? [],
          assignedRoles: parsed.assignedRoles ?? parsed.roles ?? [],
          originalRoles: parsed.originalRoles ?? parsed.roles ?? [],
        } as AuthState;
      } catch {
      }
    }
  }

  return {
    token: null,
    refreshToken: null,
    roles: [],
    permissions: [],
    companyId: null,
    companyName: null,
    nombreCompleto: null,
    userType: null,
    empleadoId: null,
    passwordChanged: false,
    needsCompanySelection: false,
    selectedEnterprise: null,
    menu: [],
    simulatedRoleId: null,
    originalMenu: [],
    originalPermissions: [],
    assignedRoles: [],
    originalRoles: [],
  };
};

const initialState: AuthState = createInitialState();

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setAuth(auth: AuthPayload) {
      const stateWithOriginals: AuthState = {
        token: auth.token,
        refreshToken: auth.refreshToken,
        roles: auth.roles,
        permissions: auth.permissions,
        companyId: auth.companyId ?? null,
        companyName: auth.companyName ?? null,
        nombreCompleto: auth.nombreCompleto ?? null,
        userType: auth.userType ?? null,
        empleadoId: auth.empleadoId ?? null,
        passwordChanged: auth.passwordChanged,
        needsCompanySelection: auth.needsCompanySelection,
        selectedEnterprise: auth.selectedEnterprise ?? null,
        menu: auth.menu,
        simulatedRoleId: auth.simulatedRoleId ?? null,
        originalMenu: auth.originalMenu ?? auth.menu ?? [],
        originalPermissions: auth.originalPermissions ?? auth.permissions ?? [],
        assignedRoles: auth.assignedRoles ?? auth.roles ?? [],
        originalRoles: auth.originalRoles ?? auth.roles ?? [],
      };
      patchState(store, stateWithOriginals);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth', JSON.stringify(stateWithOriginals));
      }
    },
    setToken(token: string) {
      patchState(store, { token });
      if (typeof window !== 'undefined') {
        const current = {
          token,
          refreshToken: store.refreshToken(),
          roles: store.roles(),
          permissions: store.permissions(),
          companyId: store.companyId(),
          companyName: store.companyName(),
          nombreCompleto: store.nombreCompleto(),
          userType: store.userType(),
          empleadoId: store.empleadoId(),
          passwordChanged: store.passwordChanged(),
          needsCompanySelection: store.needsCompanySelection(),
          selectedEnterprise: store.selectedEnterprise(),
          menu: store.menu(),
          simulatedRoleId: store.simulatedRoleId(),
          originalMenu: store.originalMenu(),
          originalPermissions: store.originalPermissions(),
          assignedRoles: store.assignedRoles(),
          originalRoles: store.originalRoles(),
        } as AuthState;
        window.localStorage.setItem('auth', JSON.stringify(current));
      }
    },
    setSelectedEnterprise(enterprise: Enterprise) {
      patchState(store, { selectedEnterprise: enterprise });
      if (typeof window !== 'undefined') {
        const current = {
          token: store.token(),
          refreshToken: store.refreshToken(),
          roles: store.roles(),
          permissions: store.permissions(),
          companyId: store.companyId(),
          companyName: store.companyName(),
          nombreCompleto: store.nombreCompleto(),
          userType: store.userType(),
          empleadoId: store.empleadoId(),
          passwordChanged: store.passwordChanged(),
          needsCompanySelection: store.needsCompanySelection(),
          selectedEnterprise: enterprise,
          menu: store.menu(),
          simulatedRoleId: store.simulatedRoleId(),
          originalMenu: store.originalMenu(),
          originalPermissions: store.originalPermissions(),
          assignedRoles: store.assignedRoles(),
          originalRoles: store.originalRoles(),
        } as AuthState;
        window.localStorage.setItem('auth', JSON.stringify(current));
      }
    },
    setMenu(menu: Menu[]) {
      patchState(store, { menu, originalMenu: menu });
      if (typeof window !== 'undefined') {
        const current = {
          token: store.token(),
          refreshToken: store.refreshToken(),
          roles: store.roles(),
          permissions: store.permissions(),
          companyId: store.companyId(),
          companyName: store.companyName(),
          nombreCompleto: store.nombreCompleto(),
          userType: store.userType(),
          empleadoId: store.empleadoId(),
          passwordChanged: store.passwordChanged(),
          needsCompanySelection: store.needsCompanySelection(),
          selectedEnterprise: store.selectedEnterprise(),
          menu: menu,
          simulatedRoleId: store.simulatedRoleId(),
          originalMenu: menu,
          originalPermissions: store.originalPermissions(),
          assignedRoles: store.assignedRoles(),
          originalRoles: store.originalRoles(),
        } as AuthState;
        window.localStorage.setItem('auth', JSON.stringify(current));
      }
    },
    simulateRole(roleId: number | null, roleName: string, menu: Menu[], permissions: string[]) {
      const origRoles = store.originalRoles().length > 0 ? store.originalRoles() : store.roles();
      patchState(store, {
        simulatedRoleId: roleId,
        roles: [roleName],
        menu: menu,
        permissions: permissions,
        originalRoles: origRoles
      });
      if (typeof window !== 'undefined') {
        const current = {
          token: store.token(),
          refreshToken: store.refreshToken(),
          roles: [roleName],
          permissions: permissions,
          companyId: store.companyId(),
          companyName: store.companyName(),
          nombreCompleto: store.nombreCompleto(),
          userType: store.userType(),
          empleadoId: store.empleadoId(),
          passwordChanged: store.passwordChanged(),
          needsCompanySelection: store.needsCompanySelection(),
          selectedEnterprise: store.selectedEnterprise(),
          menu: menu,
          simulatedRoleId: roleId,
          originalMenu: store.originalMenu(),
          originalPermissions: store.originalPermissions(),
          assignedRoles: store.assignedRoles(),
          originalRoles: origRoles,
        } as AuthState;
        window.localStorage.setItem('auth', JSON.stringify(current));
      }
    },
    stopSimulation() {
      const origMenu = store.originalMenu();
      const origPerms = store.originalPermissions();
      const origRoles = store.originalRoles().length > 0 ? store.originalRoles() : store.roles();
      patchState(store, {
        simulatedRoleId: null,
        roles: origRoles,
        menu: origMenu,
        permissions: origPerms
      });
      if (typeof window !== 'undefined') {
        const current = {
          token: store.token(),
          refreshToken: store.refreshToken(),
          roles: origRoles,
          permissions: origPerms,
          companyId: store.companyId(),
          companyName: store.companyName(),
          nombreCompleto: store.nombreCompleto(),
          userType: store.userType(),
          empleadoId: store.empleadoId(),
          passwordChanged: store.passwordChanged(),
          needsCompanySelection: store.needsCompanySelection(),
          selectedEnterprise: store.selectedEnterprise(),
          menu: origMenu,
          simulatedRoleId: null,
          originalMenu: origMenu,
          originalPermissions: origPerms,
          assignedRoles: store.assignedRoles(),
          originalRoles: origRoles,
        } as AuthState;
        window.localStorage.setItem('auth', JSON.stringify(current));
      }
    },
    hasPermission(permission: string): boolean {
      return (store.permissions() ?? []).includes(permission);
    },
    logout() {
      patchState(store, createInitialState(false));
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('auth');
      }
    }
  }))
);

