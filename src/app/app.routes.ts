import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

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
        path: 'company',
        data: { ventana: 'VISTA_COMPANY' },
        loadComponent: () => import('./pages/admin/company/company.component').then((m) => m.CompanyComponent)
      },
      {
        path: 'admin/company',
        data: { ventana: 'VISTA_COMPANY' },
        loadComponent: () => import('./pages/admin/company/company.component').then((m) => m.CompanyComponent)
      },
      {
        path: 'auditoria',
        data: { ventana: 'VISTA_AUDITORIA_ADMIN' },
        loadComponent: () => import('./pages/admin/auditoria/auditoria.component').then((m) => m.AuditoriaComponent)
      },
      {
        path: 'admin/auditoria',
        data: { ventana: 'VISTA_AUDITORIA_ADMIN' },
        loadComponent: () => import('./pages/admin/auditoria/auditoria.component').then((m) => m.AuditoriaComponent)
      },
      {
        path: 'roles',
        data: { ventana: 'VISTA_ROLES' },
        loadComponent: () => import('./pages/admin/roles/roles.component').then((m) => m.RolesComponent)
      },
      {
        path: 'admin/roles',
        data: { ventana: 'VISTA_ROLES' },
        loadComponent: () => import('./pages/admin/roles/roles.component').then((m) => m.RolesComponent)
      },
      {
        path: 'ventanas',
        data: { ventana: 'VISTA_VENTANAS' },
        loadComponent: () => import('./pages/admin/ventanas/ventanas.component').then((m) => m.VentanasComponent)
      },
      {
        path: 'admin/ventanas',
        data: { ventana: 'VISTA_VENTANAS' },
        loadComponent: () => import('./pages/admin/ventanas/ventanas.component').then((m) => m.VentanasComponent)
      },
      {
        path: 'complementario',
        data: { ventana: 'VISTA_COMPLEMENTARIO' },
        loadComponent: () => import('./pages/admin/complementario/complementario.component').then((m) => m.ComplementarioComponent)
      },
      {
        path: 'admin/complementario',
        data: { ventana: 'VISTA_COMPLEMENTARIO' },
        loadComponent: () => import('./pages/admin/complementario/complementario.component').then((m) => m.ComplementarioComponent)
      },
      {
        path: 'empleados',
        data: { ventana: 'VISTA_EMPLEADOS' },
        loadComponent: () => import('./pages/admin/employee/employee.component').then((m) => m.EmployeeComponent)
      },
      {
        path: 'admin/empleados',
        data: { ventana: 'VISTA_EMPLEADOS' },
        loadComponent: () => import('./pages/admin/employee/employee.component').then((m) => m.EmployeeComponent)
      },
      {
        path: 'clientes',
        data: { ventana: 'VISTA_CLIENTES' },
        loadComponent: () => import('./pages/admin/client/client.component').then((m) => m.ClientComponent)
      },
      {
        path: 'admin/clientes',
        data: { ventana: 'VISTA_CLIENTES' },
        loadComponent: () => import('./pages/admin/client/client.component').then((m) => m.ClientComponent)
      },
      {
        path: 'mascotas',
        data: { ventana: 'VISTA_MASCOTAS' },
        loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
      },
      {
        path: 'admin/mascotas',
        data: { ventana: 'VISTA_MASCOTAS' },
        loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
      },
      {
        path: 'empleado/mascotas',
        data: { ventana: 'VISTA_MASCOTAS' },
        loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
      },
      {
        path: 'recetas',
        data: { ventana: 'VISTA_RECETAS' },
        loadComponent: () => import('./pages/mascotas/lista-recetas/lista-recetas.component').then((m) => m.ListaRecetasComponent)
      },
      {
        path: 'admin/recetas',
        data: { ventana: 'VISTA_RECETAS' },
        loadComponent: () => import('./pages/mascotas/lista-recetas/lista-recetas.component').then((m) => m.ListaRecetasComponent)
      },
      {
        path: 'empleado/recetas',
        data: { ventana: 'VISTA_RECETAS' },
        loadComponent: () => import('./pages/mascotas/lista-recetas/lista-recetas.component').then((m) => m.ListaRecetasComponent)
      },
      {
        path: 'historias-clinicas',
        data: { ventana: 'VISTA_HISTORIAS' },
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
        data: { ventana: 'VISTA_HISTORIAS' },
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
        data: { ventana: 'VISTA_HISTORIAS' },
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
        path: 'admin/empleados/horarios',
        data: { ventana: 'VISTA_HORARIOS' },
        loadComponent: () => import('./pages/admin/employee/roster/roster.component').then((m) => m.RosterComponent)
      },
      {
        path: 'empleados/horarios',
        data: { ventana: 'VISTA_HORARIOS' },
        loadComponent: () => import('./pages/admin/employee/roster/roster.component').then((m) => m.RosterComponent)
      },
      {
        path: 'admin/empleados/:id/horario',
        data: { ventana: 'VISTA_HORARIOS' },
        loadComponent: () => import('./pages/admin/employee/schedule-management/schedule-management.component').then((m) => m.ScheduleManagementComponent)
      },
      {
        path: 'empleados/:id/horario',
        data: { ventana: 'VISTA_HORARIOS' },
        loadComponent: () => import('./pages/admin/employee/schedule-management/schedule-management.component').then((m) => m.ScheduleManagementComponent)
      },
      {
        path: 'empleado/mi-horario',
        data: { ventana: 'VISTA_MI_HORARIO' },
        loadComponent: () => import('./pages/employee/my-schedule/my-schedule.component').then(m => m.MyScheduleComponent)
      },
      {
        path: 'mi-horario',
        data: { ventana: 'VISTA_MI_HORARIO' },
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
        data: { ventana: 'VISTA_APODERADO_DASHBOARD' },
        loadComponent: () => import('./pages/apoderado/dashboard/apoderado-dashboard.component').then((m) => m.ApoderadoDashboardComponent)
      },
      {
        path: 'apoderado/mis-citas',
        data: { ventana: 'VISTA_MIS_CITAS' },
        loadComponent: () => import('./pages/apoderado/citas/citas.component').then((m) => m.CitasComponent)
      },
      {
        path: 'apoderado/mis-mascotas',
        data: { ventana: 'VISTA_MIS_MASCOTAS' },
        loadComponent: () => import('./pages/apoderado/mis-mascotas/mis-mascotas.component').then((m) => m.MisMascotasComponent)
      },
      {
        path: 'apoderado/mi-historial',
        data: { ventana: 'VISTA_MI_HISTORIAL' },
        loadComponent: () => import('./pages/apoderado/mi-historial/mi-historial.component').then((m) => m.MiHistorialComponent)
      },
      {
        path: 'apoderado/mis-recetas',
        data: { ventana: 'VISTA_MIS_RECETAS' },
        loadComponent: () => import('./pages/apoderado/mis-recetas/mis-recetas.component').then((m) => m.MisRecetasComponent)
      },
      {
        path: 'mi-historial/:mascotaId',
        data: { ventana: 'VISTA_MI_HISTORIAL' },
        loadComponent: () => import('./pages/apoderado/mi-historial/mi-historial.component').then((m) => m.MiHistorialComponent)
      },
      {
        path: 'apoderado/mis-pagos',
        data: { ventana: 'VISTA_MIS_PAGOS' },
        loadComponent: () => import('./pages/apoderado/mis-pagos/mis-pagos.component').then((m) => m.MisPagosComponent)
      },
      {
        path: 'admin/pagos',
        data: { ventana: 'VISTA_PAGOS' },
        loadComponent: () => import('./pages/admin/pagos/historial-pagos/historial-pagos.component').then((m) => m.HistorialPagosComponent)
      },
      {
        path: 'pagos',
        data: { ventana: 'VISTA_PAGOS' },
        loadComponent: () => import('./pages/admin/pagos/historial-pagos/historial-pagos.component').then((m) => m.HistorialPagosComponent)
      },
      {
        path: 'laboratorio',
        data: { ventana: 'VISTA_LABORATORIO' },
        loadComponent: () => import('./pages/laboratorio/laboratorio.component').then((m) => m.LaboratorioComponent)
      },
      {
        path: 'admin/laboratorio',
        data: { ventana: 'VISTA_LABORATORIO' },
        loadComponent: () => import('./pages/laboratorio/laboratorio.component').then((m) => m.LaboratorioComponent)
      },
      {
        path: 'empleado/laboratorio',
        data: { ventana: 'VISTA_LABORATORIO' },
        loadComponent: () => import('./pages/laboratorio/laboratorio.component').then((m) => m.LaboratorioComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
