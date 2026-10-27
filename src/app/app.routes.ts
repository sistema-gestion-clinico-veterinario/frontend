import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'privacidad',
    loadComponent: () => import('./pages/legal/aviso-publico/aviso-publico.component').then((m) => m.AvisoPublicoComponent)
  },
  {
    path: 'acceso-denegado',
    loadComponent: () => import('./pages/errors/forbidden/forbidden.component').then((m) => m.ForbiddenComponent)
  },
  {
    path: 'cuenta-cerrada',
    loadComponent: () => import('./pages/auth/account-closed/account-closed.component').then((m) => m.AccountClosedComponent)
  },
  {
    path: 'reactivate-account',
    loadComponent: () => import('./pages/auth/reactivate-account/reactivate-account.component').then((m) => m.ReactivateAccountComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent)
  },
  {
    path: 'confirm-email-change',
    loadComponent: () => import('./pages/auth/confirm-email-change/confirm-email-change.component').then((m) => m.ConfirmEmailChangeComponent)
  },
  {
    path: 'auth/google/callback',
    loadComponent: () => import('./pages/auth/google-callback/google-callback.component').then((m) => m.GoogleCallbackComponent)
  },
  {
    path: 'auth/verify',
    loadComponent: () => import('./pages/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent)
  },
  {
    path: 'auth/verify/:token',
    loadComponent: () => import('./pages/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent)
  },
  {
    path: '',
    loadChildren: () => import('./authenticated.routes').then((m) => m.AUTHENTICATED_ROUTES)
  },
  {
    path: '**',
    loadComponent: () => import('./pages/errors/not-found/not-found.component').then((m) => m.NotFoundComponent)
  }
];
