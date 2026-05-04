import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
