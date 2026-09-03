import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RouteMapperService {
  private readonly routeMap: { [codigo: string]: string } = {
    VISTA_DASHBOARD: '/dashboard',
    VISTA_DASHBOARD_ADMIN: '/admin/dashboard',
    VISTA_DASHBOARD_EMPLEADO: '/empleado/dashboard',

    VISTA_REPORTES: '/reportes',
    VISTA_REPORTES_ADMIN: '/admin/reportes',

    VISTA_COMPANY: '/admin/company',
    VISTA_COMPANY_ADMIN: '/admin/company',

    VISTA_AUDITORIA_ADMIN: '/admin/auditoria',
    VISTA_AUDITORIA: '/auditoria',

    VISTA_ROLES: '/admin/roles',
    VISTA_ROLES_ADMIN: '/admin/roles',
    VISTA_VENTANAS: '/admin/ventanas',

    VISTA_COMPLEMENTARIO: '/admin/complementario',
    VISTA_COMPLEMENTARIO_ADMIN: '/admin/complementario',

    VISTA_EMPLEADOS: '/admin/empleados',
    VISTA_EMPLEADOS_ADMIN: '/admin/empleados',
    VISTA_EMPLEADOS_LISTAR: '/empleados',

    VISTA_CLIENTES: '/clientes',
    VISTA_CLIENTES_ADMIN: '/admin/clientes',
    VISTA_APODERADOS: '/clientes',
    VISTA_APODERADOS_ADMIN: '/admin/clientes',

    VISTA_MASCOTAS: '/mascotas',
    VISTA_MASCOTAS_ADMIN: '/admin/mascotas',
    VISTA_MASCOTAS_EMPLEADO: '/empleado/mascotas',

    VISTA_RECETAS: '/recetas',
    VISTA_RECETAS_ADMIN: '/admin/recetas',
    VISTA_RECETAS_EMPLEADO: '/empleado/recetas',

    VISTA_HISTORIAS: '/historias-clinicas',
    VISTA_HISTORIAS_CLINICAS: '/historias-clinicas',
    VISTA_HISTORIAS_MASCOTA: '/historias-clinicas/mascota/:numeroHc',
    VISTA_HISTORIAS_CONSULTA: '/historias-clinicas/consulta/:consultaId',
    VISTA_HISTORIAS_ADMIN: '/admin/historias-clinicas',
    VISTA_HISTORIAS_MASCOTA_ADMIN: '/admin/historias-clinicas/mascota/:numeroHc',
    VISTA_HISTORIAS_CONSULTA_ADMIN: '/admin/historias-clinicas/consulta/:consultaId',
    VISTA_HISTORIAS_EMPLEADO: '/empleado/historias-clinicas',
    VISTA_HISTORIAS_MASCOTA_EMP: '/empleado/historias-clinicas/mascota/:numeroHc',
    VISTA_HISTORIAS_CONSULTA_EMP: '/empleado/historias-clinicas/consulta/:consultaId',

    VISTA_CARTILLA: '/historias-clinicas/cartilla',

    VISTA_CITAS_AGENDA: '/citas/agenda',
    VISTA_CITAS: '/citas/agenda',
    VISTA_AGENDA: '/citas/agenda',
    VISTA_CITAS_AGENDA_ADMIN: '/admin/citas/agenda',
    VISTA_CITAS_AGENDA_EMPLEADO: '/empleado/citas/agenda',

    VISTA_HORARIOS: '/admin/empleados/horarios',
    VISTA_HORARIOS_ADMIN: '/admin/empleados/horarios',
    VISTA_HORARIO_DETALLE: '/empleados/:id/horario',
    VISTA_HORARIO_DETALLE_ADMIN: '/admin/empleados/:id/horario',

    VISTA_MI_HORARIO: '/mi-horario',
    VISTA_MI_HORARIO_EMPLEADO: '/empleado/mi-horario',

    VISTA_PROFILE: '/profile',
    VISTA_PERFIL: '/profile',
    VISTA_PASSWORD_CHANGE: '/password-change',

    VISTA_APODERADO_PORTAL: '/apoderado',
    VISTA_APODERADO: '/apoderado/dashboard',
    VISTA_APODERADO_DASHBOARD: '/apoderado/dashboard',

    VISTA_MIS_CITAS: '/apoderado/mis-citas',
    VISTA_MIS_CITAS_APODERADO: '/apoderado/mis-citas',

    VISTA_MIS_MASCOTAS: '/apoderado/mis-mascotas',
    VISTA_MIS_MASCOTAS_APODERADO: '/apoderado/mis-mascotas',

    VISTA_MI_HISTORIAL: '/apoderado/mi-historial',
    VISTA_MI_HISTORIAL_APODERADO: '/apoderado/mi-historial',

    VISTA_MIS_RECETAS: '/apoderado/mis-recetas',
    VISTA_MIS_RECETAS_APODERADO: '/apoderado/mis-recetas',

    VISTA_MIS_PAGOS: '/apoderado/mis-pagos',
    VISTA_MIS_PAGOS_APODERADO: '/apoderado/mis-pagos',

    VISTA_PAGOS: '/admin/pagos',
    VISTA_PAGOS_ADMIN: '/admin/pagos',

    VISTA_CAJA: '/admin/caja',
    VISTA_CAJA_ADMIN: '/admin/caja',
    VISTA_LABORATORIO: '/laboratorio',
    VISTA_EMPLEADO_DASHBOARD: '/empleado/dashboard',
    VISTA_EMPRESA: '/company',
    VISTA_APODERADO_MI_HISTORIAL: '/apoderado/mi-historial',
    VISTA_EMPLEADOS_HORARIOS: '/empleados/horarios',
  };

  private readonly iconMap: Record<string, string> = {
    VISTA_DASHBOARD: 'pi pi-home',
    VISTA_DASHBOARD_ADMIN: 'pi pi-home',
    VISTA_DASHBOARD_EMPLEADO: 'pi pi-home',
    VISTA_EMPLEADO_DASHBOARD: 'pi pi-home',
    VISTA_REPORTES: 'pi pi-chart-pie',
    VISTA_COMPANY: 'pi pi-building',
    VISTA_AUDITORIA_ADMIN: 'pi pi-list-check',
    VISTA_ROLES: 'pi pi-shield',
    VISTA_VENTANAS: 'pi pi-sitemap',
    VISTA_COMPLEMENTARIO: 'pi pi-database',
    VISTA_PAGOS: 'pi pi-wallet',
    VISTA_CAJA: 'pi pi-money-bill',
    VISTA_EMPLEADOS: 'pi pi-users',
    VISTA_HORARIOS: 'pi pi-calendar-clock',
    VISTA_MI_HORARIO: 'pi pi-clock',
    VISTA_CLIENTES: 'pi pi-address-book',
    VISTA_MASCOTAS: 'pi pi-heart',
    VISTA_RECETAS: 'pi pi-file-edit',
    VISTA_HISTORIAS: 'pi pi-folder-open',
    VISTA_CARTILLA: 'pi pi-shield',
    VISTA_CITAS_AGENDA: 'pi pi-calendar',
    VISTA_APODERADO_DASHBOARD: 'pi pi-chart-line',
    VISTA_MIS_MASCOTAS: 'pi pi-heart-fill',
    VISTA_MIS_CITAS: 'pi pi-calendar-plus',
    VISTA_MI_HISTORIAL: 'pi pi-book',
    VISTA_MIS_RECETAS: 'pi pi-file-edit',
    VISTA_MIS_PAGOS: 'pi pi-credit-card',
    VISTA_PROFILE: 'pi pi-user',
    VISTA_LABORATORIO: 'pi pi-circle'
  };

  getRoute(codigo: string): string | null {
    return this.routeMap[codigo] || null;
  }

  getRouteOrDefault(codigo: string, defaultRoute: string = '/'): string {
    return this.routeMap[codigo] || defaultRoute;
  }

  getIcon(codigo: string): string {
    return this.iconMap[codigo] || 'pi pi-circle';
  }
}
