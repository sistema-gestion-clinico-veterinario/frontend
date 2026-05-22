import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { Permission } from './core/enums/permission.enum';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent) // forgot password route
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent) // reset password route
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
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'admin/dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'admin/company',
        data: { permission: Permission.COMPANY_MANAGE },
        loadComponent: () => import('./pages/admin/company/company.component').then((m) => m.CompanyComponent)
      },
      {
        path: 'company',
        data: { permission: Permission.COMPANY_MANAGE },
        loadComponent: () => import('./pages/admin/company/company.component').then((m) => m.CompanyComponent)
      },
      {
        path: 'admin/auditoria',
        data: { permission: Permission.COMPANY_MANAGE },
        loadComponent: () => import('./pages/admin/auditoria/auditoria.component').then((m) => m.AuditoriaComponent)
      },
      {
        path: 'auditoria',
        data: { permission: Permission.COMPANY_MANAGE },
        loadComponent: () => import('./pages/admin/auditoria/auditoria.component').then((m) => m.AuditoriaComponent)
      },
      {
        path: 'admin/roles',
        data: { permission: Permission.ROLE_MANAGE },
        loadComponent: () => import('./pages/admin/roles/roles.component').then((m) => m.RolesComponent)
      },
      {
        path: 'roles',
        data: { permission: Permission.ROLE_MANAGE },
        loadComponent: () => import('./pages/admin/roles/roles.component').then((m) => m.RolesComponent)
      },
      {
        path: 'admin/ventanas',
        data: { permission: Permission.ROLE_MANAGE },
        loadComponent: () => import('./pages/admin/ventanas/ventanas.component').then((m) => m.VentanasComponent)
      },
      {
        path: 'ventanas',
        data: { permission: Permission.ROLE_MANAGE },
        loadComponent: () => import('./pages/admin/ventanas/ventanas.component').then((m) => m.VentanasComponent)
      },
      {
        path: 'admin/complementario',
        data: { permission: Permission.USER_MANAGE },
        loadComponent: () => import('./pages/admin/complementario/complementario.component').then((m) => m.ComplementarioComponent)
      },
      {
        path: 'complementario',
        data: { permission: Permission.USER_MANAGE },
        loadComponent: () => import('./pages/admin/complementario/complementario.component').then((m) => m.ComplementarioComponent)
      },
      {
        path: 'admin/empleados',
        data: { permission: Permission.EMPLEADO_READ },
        loadComponent: () => import('./pages/admin/employee/employee.component').then((m) => m.EmployeeComponent)
      },
      {
        path: 'empleados',
        data: { permission: Permission.EMPLEADO_READ },
        loadComponent: () => import('./pages/admin/employee/employee.component').then((m) => m.EmployeeComponent)
      },
      {
        path: 'admin/clientes',
        data: { permission: Permission.APODERADO_READ },
        loadComponent: () => import('./pages/admin/client/client.component').then((m) => m.ClientComponent)
      },
      {
        path: 'clientes',
        data: { permission: Permission.APODERADO_READ },
        loadComponent: () => import('./pages/admin/client/client.component').then((m) => m.ClientComponent)
      },
      {
        path: 'mascotas',
        data: { permission: Permission.PET_READ },
        loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
      },
      {
        path: 'admin/mascotas',
        data: { permission: Permission.PET_READ },
        loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
      },
      {
        path: 'empleado/mascotas',
        data: { permission: Permission.PET_READ },
        loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
      },
      {
        path: 'recetas',
        data: { permission: Permission.PET_HISTORY_READ },
        loadComponent: () => import('./pages/mascotas/lista-recetas/lista-recetas.component').then((m) => m.ListaRecetasComponent)
      },
      {
        path: 'admin/recetas',
        data: { permission: Permission.PET_HISTORY_READ },
        loadComponent: () => import('./pages/mascotas/lista-recetas/lista-recetas.component').then((m) => m.ListaRecetasComponent)
      },
      {
        path: 'empleado/recetas',
        data: { permission: Permission.PET_HISTORY_READ },
        loadComponent: () => import('./pages/mascotas/lista-recetas/lista-recetas.component').then((m) => m.ListaRecetasComponent)
      },
      {
        path: 'historias-clinicas',
        data: { permission: Permission.CLINICAL_RECORD_READ },
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
        path: 'admin/historias-clinicas',
        data: { permission: Permission.CLINICAL_RECORD_READ },
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
        path: 'empleado/historias-clinicas',
        data: { permission: Permission.CLINICAL_RECORD_READ },
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
        data: { ventana: 'VISTA_CITAS_AGENDA' },
        children: [
          {
            path: 'agenda',
            loadComponent: () => import('./pages/citas/agenda/agenda.component').then((m) => m.AgendaComponent)
          }
        ]
      },
      {
        path: 'admin/citas',
        data: { ventana: 'VISTA_CITAS_AGENDA' },
        children: [
          {
            path: 'agenda',
            loadComponent: () => import('./pages/citas/agenda/agenda.component').then((m) => m.AgendaComponent)
          }
        ]
      },
      {
        path: 'empleado/citas',
        data: { ventana: 'VISTA_CITAS_AGENDA' },
        children: [
          {
            path: 'agenda',
            loadComponent: () => import('./pages/citas/agenda/agenda.component').then((m) => m.AgendaComponent)
          }
        ]
      },
      {
        path: 'agenda',
        data: { ventana: 'VISTA_CITAS_AGENDA' },
        loadComponent: () => import('./pages/citas/agenda/agenda.component').then((m) => m.AgendaComponent)
      },
      {
        path: 'empleado/agenda',
        data: { ventana: 'VISTA_CITAS_AGENDA' },
        loadComponent: () => import('./pages/citas/agenda/agenda.component').then((m) => m.AgendaComponent)
      },
      {
        path: 'admin/empleados/horarios',
        data: { permission: Permission.HORARIO_READ },
        loadComponent: () => import('./pages/admin/employee/roster/roster.component').then((m) => m.RosterComponent)
      },
      {
        path: 'empleados/horarios',
        data: { permission: Permission.HORARIO_READ },
        loadComponent: () => import('./pages/admin/employee/roster/roster.component').then((m) => m.RosterComponent)
      },
      {
        path: 'admin/empleados/:id/horario',
        data: { permission: Permission.HORARIO_READ },
        loadComponent: () => import('./pages/admin/employee/schedule-management/schedule-management.component').then((m) => m.ScheduleManagementComponent)
      },
      {
        path: 'empleados/:id/horario',
        data: { permission: Permission.HORARIO_READ },
        loadComponent: () => import('./pages/admin/employee/schedule-management/schedule-management.component').then((m) => m.ScheduleManagementComponent)
      },
      {
        path: 'empleado/mi-horario',
        data: { permission: Permission.USER_READ },
        loadComponent: () => import('./pages/employee/my-schedule/my-schedule.component').then(m => m.MyScheduleComponent)
      },
      {
        path: 'mi-horario',
        data: { permission: Permission.USER_READ },
        loadComponent: () => import('./pages/employee/my-schedule/my-schedule.component').then(m => m.MyScheduleComponent)
      },
      {
        path: 'empleado/dashboard',
        loadComponent: () => import('./pages/employee/dashboard/employee-dashboard.component').then((m) => m.EmployeeDashboardComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent)
      },
      {
        path: 'password-change',
        loadComponent: () => import('./pages/auth/password-change/password-change.component').then((m) => m.PasswordChangeComponent)
      },
      {
        path: 'apoderado/dashboard',
        data: { permission: Permission.APODERADO_DASHBOARD },
        loadComponent: () => import('./pages/apoderado/dashboard/apoderado-dashboard.component').then((m) => m.ApoderadoDashboardComponent)
      },
      {
        path: 'apoderado',
        loadComponent: () => import('./pages/apoderado-portal/apoderado-portal.component').then((m) => m.ApoderadoPortalComponent)
      },
      {
        path: 'mis-citas',
        loadComponent: () => import('./pages/apoderado/citas/citas.component').then((m) => m.CitasComponent)
      },
      {
        path: 'apoderado/mis-citas',
        loadComponent: () => import('./pages/apoderado/citas/citas.component').then((m) => m.CitasComponent)
      },
      {
        path: 'mis-mascotas',
        loadComponent: () => import('./pages/apoderado/mis-mascotas/mis-mascotas.component').then((m) => m.MisMascotasComponent)
      },
      {
        path: 'apoderado/mis-mascotas',
        loadComponent: () => import('./pages/apoderado/mis-mascotas/mis-mascotas.component').then((m) => m.MisMascotasComponent)
      },
      {
        path: 'apoderado/mi-historial',
        loadComponent: () => import('./pages/apoderado/mi-historial/mi-historial.component').then((m) => m.MiHistorialComponent)
      },
      {
        path: 'mi-historial/:mascotaId',
        loadComponent: () => import('./pages/apoderado/mi-historial/mi-historial.component').then((m) => m.MiHistorialComponent)
      },
      {
        path: 'mis-pagos',
        loadComponent: () => import('./pages/apoderado/mis-pagos/mis-pagos.component').then((m) => m.MisPagosComponent)
      },
      {
        path: 'apoderado/mis-pagos',
        loadComponent: () => import('./pages/apoderado/mis-pagos/mis-pagos.component').then((m) => m.MisPagosComponent)
      },
      {
        path: 'admin/pagos',
        data: { permission: Permission.SALE_READ },
        loadComponent: () => import('./pages/admin/pagos/historial-pagos/historial-pagos.component').then((m) => m.HistorialPagosComponent)
      },
      {
        path: 'pagos',
        data: { permission: Permission.SALE_READ },
        loadComponent: () => import('./pages/admin/pagos/historial-pagos/historial-pagos.component').then((m) => m.HistorialPagosComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
