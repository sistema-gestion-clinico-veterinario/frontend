import { ApplicationConfig, ErrorHandler, inject, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withNavigationErrorHandler, UrlSerializer } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { SlugUrlSerializer } from './core/routing/slug-url-serializer';
import { ManejadorErroresGlobal } from './core/services/manejador-errores-global';
import { VersionNuevaService } from './core/services/version-nueva.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled'
    }), withNavigationErrorHandler(({ error }) => {
      inject(VersionNuevaService).registrarError(error);
    })),
    { provide: ErrorHandler, useClass: ManejadorErroresGlobal },
    { provide: UrlSerializer, useClass: SlugUrlSerializer },
    provideHttpClient(withInterceptors([apiInterceptor]))
  ]
};
