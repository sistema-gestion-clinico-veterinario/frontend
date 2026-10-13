import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .then(() => scheduleObservability())
  .catch((err) => console.error(err));


function scheduleObservability(): void {
  const load = () => {
    void Promise.all([
      import('@vercel/analytics').then(({ inject }) => inject()),
      import('@vercel/speed-insights').then(({ injectSpeedInsights }) => injectSpeedInsights())
    ]).catch((error) => console.warn('No se pudo inicializar la telemetría.', error));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 2_000 });
    return;
  }

  globalThis.setTimeout(load, 1_000);
}
