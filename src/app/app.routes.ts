import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { Role } from './core/enums/role.enum';

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
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        data: { roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA] },
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'admin/company',
        data: { roles: [Role.SUPER_ADMIN] },
        loadComponent: () => import('./pages/admin/company/company.component').then((m) => m.CompanyComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
