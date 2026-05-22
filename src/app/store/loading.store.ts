import { signalStore, withState, withMethods, patchState, withComputed } from '@ngrx/signals';
import { computed } from '@angular/core';

export const LoadingStore = signalStore(
  { providedIn: 'root' },
  withState({ activeRequests: 0 }),
  withComputed((store) => ({
    isLoading: computed(() => store.activeRequests() > 0),
  })),
  withMethods((store) => ({
    show() {
      patchState(store, { activeRequests: store.activeRequests() + 1 });
    },
    hide() {
      patchState(store, { activeRequests: Math.max(0, store.activeRequests() - 1) });
    },
  }))
);
