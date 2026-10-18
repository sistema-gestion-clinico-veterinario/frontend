import { inject, provideEnvironmentInitializer } from '@angular/core';
import { Routes } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import Aura from '@primeng/themes/aura';
import { PrimeNG } from 'primeng/config';
import { AuthGuard } from './core/guards/auth.guard';
import { APP_ROUTE_PATHS } from './core/routing/app-routes.constants';

export const AUTHENTICATED_PRIMENG_CONFIG = {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: 'none',
      cssLayer: {
        name: 'primeng',
        order: 'tailwind-base, primeng, tailwind-utilities'
      }
    }
  }
};

export const AUTHENTICATED_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout.component')
      .then((m) => m.MainLayoutComponent),
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    providers: [
      provideAnimationsAsync(),
      // `providePrimeNG` usa un inicializador de aplicación y no se ejecuta
      // al declararlo dentro de una ruta lazy. El inicializador de entorno sí
      // corre antes de crear el layout y configura la instancia global.
      provideEnvironmentInitializer(() => {
        inject(PrimeNG).setConfig(AUTHENTICATED_PRIMENG_CONFIG);
      })
    ],
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
        path: 'reportes',
        data: { ventana: 'VISTA_REPORTES' },
        loadComponent: () => import('./pages/reportes/reportes.component').then((m) => m.default)
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
        path: 'admin/company/:id/compliance',
        data: { ventana: 'VISTA_COMPANY', permiso: 'leer', purposes: ['PLATFORM_ADMIN'] },
        loadComponent: () => import('./pages/admin/company/compliance/company-compliance.component').then((m) => m.CompanyComplianceComponent)
      },
      {
        path: 'admin/privacidad',
        data: { ventana: 'VISTA_COMPANY', permiso: 'leer' },
        loadComponent: () => import('./pages/admin/privacidad/privacidad.component').then((m) => m.PrivacidadComponent)
      },
      {
        path: 'admin/privacidad/solicitudes',
        data: { ventana: 'VISTA_COMPANY', permiso: 'leer' },
        loadComponent: () => import('./pages/admin/privacidad/solicitudes/solicitudes-cancelacion.component').then((m) => m.SolicitudesCancelacionComponent)
      },
      {
        path: 'admin/privacidad/derechos',
        data: { ventana: 'VISTA_COMPANY', permiso: 'leer' },
        loadComponent: () => import('./pages/admin/privacidad/derechos/derechos-admin.component').then((m) => m.DerechosAdminComponent)
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
        path: 'admin/respaldos',
        data: { ventana: 'VISTA_RESPALDOS', permiso: 'leer', purposes: ['PLATFORM_ADMIN'] },
        loadComponent: () => import('./pages/admin/backups/backup-monitor.component').then((m) => m.BackupMonitorComponent)
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
        path: 'admin/roles/revision-accesos',
        data: { ventana: 'VISTA_ROLES' },
        loadComponent: () => import('./pages/admin/revision-accesos/revision-accesos.component').then((m) => m.RevisionAccesosComponent)
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
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
          },
          {
            path: 'form',
            loadComponent: () => import('./pages/mascotas/mascota-form/mascota-form.component').then((m) => m.MascotaFormComponent)
          },
          {
            path: 'form/:uuid',
            loadComponent: () => import('./pages/mascotas/mascota-form/mascota-form.component').then((m) => m.MascotaFormComponent)
          }
        ]
      },
      {
        path: 'admin/mascotas',
        data: { ventana: 'VISTA_MASCOTAS' },
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
          },
          {
            path: 'form',
            loadComponent: () => import('./pages/mascotas/mascota-form/mascota-form.component').then((m) => m.MascotaFormComponent)
          },
          {
            path: 'form/:uuid',
            loadComponent: () => import('./pages/mascotas/mascota-form/mascota-form.component').then((m) => m.MascotaFormComponent)
          }
        ]
      },
      {
        path: 'empleado/mascotas',
        data: { ventana: 'VISTA_MASCOTAS' },
        children: [
          {
            path: '',
            loadComponent: () => import('./pages/mascotas/lista-mascotas/lista-mascotas.component').then((m) => m.ListaMascotasComponent)
          },
          {
            path: 'form',
            loadComponent: () => import('./pages/mascotas/mascota-form/mascota-form.component').then((m) => m.MascotaFormComponent)
          },
          {
            path: 'form/:uuid',
            loadComponent: () => import('./pages/mascotas/mascota-form/mascota-form.component').then((m) => m.MascotaFormComponent)
          }
        ]
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
            path: 'mascota/:numeroHc',
            loadComponent: () => import('./pages/historias-clinicas/historia-clinica-mascota/historia-clinica-mascota.component').then((m) => m.HistoriaClinicaMascotaComponent)
          },
          {
            path: 'consulta/:consultaId',
            loadComponent: () => import('./pages/historias-clinicas/consulta/consulta-form.component').then((m) => m.ConsultaFormComponent)
          },
          {
            path: 'cartilla',
            loadComponent: () => import('./pages/cartilla/cartilla.component').then((m) => m.CartillaComponent)
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
            path: 'mascota/:numeroHc',
            loadComponent: () => import('./pages/historias-clinicas/historia-clinica-mascota/historia-clinica-mascota.component').then((m) => m.HistoriaClinicaMascotaComponent)
          },
          {
            path: 'consulta/:consultaId',
            loadComponent: () => import('./pages/historias-clinicas/consulta/consulta-form.component').then((m) => m.ConsultaFormComponent)
          },
          {
            path: 'cartilla',
            loadComponent: () => import('./pages/cartilla/cartilla.component').then((m) => m.CartillaComponent)
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
            path: 'mascota/:numeroHc',
            loadComponent: () => import('./pages/historias-clinicas/historia-clinica-mascota/historia-clinica-mascota.component').then((m) => m.HistoriaClinicaMascotaComponent)
          },
          {
            path: 'consulta/:consultaId',
            loadComponent: () => import('./pages/historias-clinicas/consulta/consulta-form.component').then((m) => m.ConsultaFormComponent)
          },
          {
            path: 'cartilla',
            loadComponent: () => import('./pages/cartilla/cartilla.component').then((m) => m.CartillaComponent)
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
        path: APP_ROUTE_PATHS.PROFILE,
        loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent)
      },
      {
        path: 'privacidad/derechos',
        loadComponent: () => import('./pages/privacy/derechos-datos.component').then((m) => m.DerechosDatosComponent)
      },
      {
        path: 'consentimientos-veterinarios',
        data: { ventana: 'VISTA_HISTORIAS', permiso: 'leer' },
        loadComponent: () => import('./pages/historias-clinicas/consentimientos/consentimientos-veterinarios.component').then((m) => m.ConsentimientosVeterinariosComponent)
      },
      {
        path: 'password-change',
        loadComponent: () => import('./pages/auth/password-change/password-change.component').then((m) => m.PasswordChangeComponent)
      },
      {
        path: APP_ROUTE_PATHS.CLINIC_PRIVACY_NOTICE,
        loadComponent: () => import('./pages/legal/aviso-clinica/aviso-clinica.component').then((m) => m.AvisoClinicaComponent)
      },
      {
        path: APP_ROUTE_PATHS.LEGAL_ACCEPTANCE,
        loadComponent: () => import('./pages/legal/accept/legal-accept.component').then((m) => m.LegalAcceptComponent)
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
        path: 'apoderado/consentimientos',
        data: { ventana: 'VISTA_MI_HISTORIAL', permiso: 'leer' },
        loadComponent: () => import('./pages/apoderado/consentimientos/consentimientos.component').then((m) => m.ConsentimientosComponent)
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
        path: 'admin/caja',
        data: { ventana: 'VISTA_CAJA' },
        loadComponent: () => import('./pages/admin/caja/caja.component').then((m) => m.CajaComponent)
      },
      {
        path: 'caja',
        data: { ventana: 'VISTA_CAJA' },
        loadComponent: () => import('./pages/admin/caja/caja.component').then((m) => m.CajaComponent)
      },
      {
        path: 'admin/productos',
        data: { ventana: 'VISTA_PRODUCTOS' },
        loadComponent: () => import('./pages/admin/productos/productos.component').then((m) => m.ProductosComponent)
      },
      {
        path: 'productos',
        data: { ventana: 'VISTA_PRODUCTOS' },
        loadComponent: () => import('./pages/admin/productos/productos.component').then((m) => m.ProductosComponent)
      },
      {
        path: 'admin/productos/nuevo',
        data: { ventana: 'VISTA_PRODUCTOS', permiso: 'escribir' },
        loadComponent: () => import('./pages/admin/productos/producto-form/producto-form.component').then((m) => m.ProductoFormComponent)
      },
      {
        path: 'admin/productos/:sku/detalle',
        data: { ventana: 'VISTA_PRODUCTOS', permiso: 'leer', modo: 'detalle' },
        loadComponent: () => import('./pages/admin/productos/producto-form/producto-form.component').then((m) => m.ProductoFormComponent)
      },
      {
        path: 'admin/productos/:sku/editar',
        data: { ventana: 'VISTA_PRODUCTOS', permiso: 'modificar' },
        loadComponent: () => import('./pages/admin/productos/producto-form/producto-form.component').then((m) => m.ProductoFormComponent)
      },
      {
        path: 'admin/lotes',
        data: { ventana: 'VISTA_LOTES' },
        loadComponent: () => import('./pages/admin/lotes/lotes.component').then((m) => m.LotesComponent)
      },
      {
        path: 'admin/categorias-producto',
        data: { ventana: 'VISTA_CATEGORIAS_PRODUCTO' },
        loadComponent: () => import('./pages/admin/categorias-producto/categorias-producto.component').then((m) => m.CategoriasProductoComponent)
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
  }
];
