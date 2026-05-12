import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

export const LoadingStore = signalStore(
  { providedIn: 'root' },
  withState({ isLoading: false }),
  withMethods((store) => ({
    show() {
      patchState(store, { isLoading: true });
    },
    hide() {
      patchState(store, { isLoading: false });
    },
  }))
);
