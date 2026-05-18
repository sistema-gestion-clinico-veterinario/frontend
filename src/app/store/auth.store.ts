import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { Menu } from '../models/response/auth-login-response.model';


interface Enterprise {
  establishmentId: number;
  name: string;
}

interface AuthState {
  token: string | null;
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
}

const createInitialState = (useStorage = true): AuthState => {
  if (useStorage && typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('auth');
    if (stored) {
      try {
        return JSON.parse(stored) as AuthState;
      } catch {
      }
    }
  }

  return {
    token: null,
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
  };
};

const initialState: AuthState = createInitialState();

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setAuth(auth: AuthState) {
      patchState(store, auth);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth', JSON.stringify(auth));
      }
    },
    setToken(token: string) {
      patchState(store, { token });
      if (typeof window !== 'undefined') {
        const current = {
          token,
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
        } as AuthState;
        window.localStorage.setItem('auth', JSON.stringify(current));
      }
    },
    setSelectedEnterprise(enterprise: Enterprise) {
      patchState(store, { selectedEnterprise: enterprise });
      if (typeof window !== 'undefined') {
        const current = {
          token: store.token(),
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

