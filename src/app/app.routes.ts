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
    path: 'auth/verify/:token',
    loadComponent: () => import('./pages/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent)
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
      },
      {
        path: 'admin/menus',
        data: { roles: [Role.SUPER_ADMIN] },
        loadComponent: () => import('./pages/admin/menu-management/menu-management.component').then((m) => m.MenuManagementComponent)
      },
      {
        path: 'admin/complementario',
        data: { roles: [Role.SUPER_ADMIN] },
        loadComponent: () => import('./pages/admin/complementario/complementario.component').then((m) => m.ComplementarioComponent)
      },
      {
        path: 'admin/empleados',
        data: { roles: [Role.SUPER_ADMIN, Role.ADMIN] },
        loadComponent: () => import('./pages/admin/employee/employee.component').then((m) => m.EmployeeComponent)
      },
      {
        path: 'admin/clientes',
        data: { roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPCIONISTA] },
        loadComponent: () => import('./pages/admin/client/client.component').then((m) => m.ClientComponent)
      },
      {
        path: 'mascotas',
        data: { roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA] },
        loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
      },
      {
        path: 'recetas',
        data: { roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA] },
        loadComponent: () => import('./pages/mascotas/lista-recetas/lista-recetas.component').then((m) => m.ListaRecetasComponent)
      },
      {
        path: 'historias-clinicas',
        data: { roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA] },
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/historias-clinicas/lista-hc/lista-hc.component').then((m) => m.ListaHcComponent)
          },
          {
            path: 'mascota/:mascotaId',
            loadComponent: () => import('./pages/historias-clinicas/historia-clinica-mascota/historia-clinica-mascota.component').then((m) => m.HistoriaClinicaMascotaComponent)
          },
          {
            path: 'consulta/:consultaId',
            loadComponent: () => import('./pages/historias-clinicas/consulta/consulta-form.component').then((m) => m.ConsultaFormComponent)
          }
        ]
      },
      {
        path: 'citas',
        data: { roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA] },
        children: [
          {
            path: 'agenda',
            loadComponent: () => import('./pages/citas/agenda/agenda.component').then((m) => m.AgendaComponent)
          }
        ]
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
