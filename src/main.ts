import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .then(() => scheduleObservability())
  .catch((err) => console.error(err));

/**
 * La telemetría no es necesaria para mostrar ni operar el login. Se carga
 * después del arranque y en tiempo ocioso para que no compita con el contenido
 * visible, manteniendo Web Analytics y Speed Insights en producción.
 */
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
