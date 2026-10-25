import { routes } from './app.routes';
import { AUTHENTICATED_PRIMENG_CONFIG, AUTHENTICATED_ROUTES } from './authenticated.routes';
import { AuthGuard } from './core/guards/auth.guard';

describe('Application routes', () => {
  it('keeps public routes available before the authenticated area', () => {
    const publicPaths = routes
      .filter((route) => route.loadComponent)
      .map((route) => route.path);

    expect(publicPaths).toEqual([
      'admin/login',
      'login',
      'privacidad',
      'acceso-denegado',
      'cuenta-cerrada',
      'reactivate-account',
      'forgot-password',
      'reset-password',
      'confirm-email-change',
      'auth/google/callback',
      'auth/verify',
      'auth/verify/:token',
      '**'
    ]);
  });

  it('loads authenticated routes lazily', () => {
    const lazyAuthenticatedRoute = routes.find((route) => route.path === '' && route.loadChildren);

    expect(lazyAuthenticatedRoute).toBeDefined();
    expect(lazyAuthenticatedRoute?.loadChildren).toEqual(jasmine.any(Function));
  });

  it('protects the authenticated layout and all its children', () => {
    const authenticatedRoot = AUTHENTICATED_ROUTES[0];

    expect(authenticatedRoot.canActivate).toContain(AuthGuard);
    expect(authenticatedRoot.canActivateChild).toContain(AuthGuard);
    expect(authenticatedRoot.children?.some((route) => route.path === 'dashboard')).toBeTrue();
  });

  it('provides a concrete PrimeNG preset before authenticated components render', () => {
    expect(AUTHENTICATED_PRIMENG_CONFIG.theme.preset).toBeDefined();
    expect(AUTHENTICATED_PRIMENG_CONFIG.theme.preset).not.toBeNull();
  });
});
