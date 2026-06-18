import { signalStore, withState, withMethods, patchState, withComputed } from '@ngrx/signals';
import { computed } from '@angular/core';

const DEFAULT_PROCESS_TITLE = 'Estamos trabajando en tu solicitud';
const DEFAULT_PROCESS_STEPS = [
  'Estamos subiendo tu documento',
  'Conectando con el servidor',
  'Estamos procesando la información',
  'Terminando'
];

export const LoadingStore = signalStore(
  { providedIn: 'root' },
  withState({
    activeRequests: 0,
    processTitle: DEFAULT_PROCESS_TITLE,
    processSteps: DEFAULT_PROCESS_STEPS
  }),
  withComputed((store) => ({
    isLoading: computed(() => store.activeRequests() > 0),
  })),
  withMethods((store) => ({
    show(options?: { title?: string; steps?: string[] }) {
      patchState(store, {
        activeRequests: store.activeRequests() + 1,
        processTitle: options?.title ?? DEFAULT_PROCESS_TITLE,
        processSteps: options?.steps?.length ? options.steps : DEFAULT_PROCESS_STEPS
      });
    },
    hide() {
      const activeRequests = Math.max(0, store.activeRequests() - 1);
      patchState(store, {
        activeRequests,
        processTitle: activeRequests > 0 ? store.processTitle() : DEFAULT_PROCESS_TITLE,
        processSteps: activeRequests > 0 ? store.processSteps() : DEFAULT_PROCESS_STEPS
      });
    },
  }))
);