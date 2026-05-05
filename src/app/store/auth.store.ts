import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

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
}

const createInitialState = (): AuthState => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('auth');
    if (stored) {
      try {
        return JSON.parse(stored) as AuthState;
      } catch {
        // ignore parse errors
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
        } as AuthState;
        window.localStorage.setItem('auth', JSON.stringify(current));
      }
    },
    logout() {
      patchState(store, createInitialState());
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('auth');
      }
    }
  }))
);

