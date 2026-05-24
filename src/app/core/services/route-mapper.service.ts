import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RouteMapperService {
  private readonly routeMap: { [codigo: string]: string } = {
    VISTA_DASHBOARD: '/dashboard',
    VISTA_DASHBOARD_ADMIN: '/admin/dashboard',
    VISTA_DASHBOARD_EMPLEADO: '/empleado/dashboard',

    VISTA_COMPANY: '/admin/company',
    VISTA_COMPANY_ADMIN: '/admin/company',

    VISTA_AUDITORIA_ADMIN: '/admin/auditoria',

    VISTA_ROLES: '/admin/roles',
    VISTA_ROLES_ADMIN: '/admin/roles',
    VISTA_VENTANAS: '/admin/ventanas',

    VISTA_COMPLEMENTARIO: '/admin/complementario',
    VISTA_COMPLEMENTARIO_ADMIN: '/admin/complementario',

    VISTA_EMPLEADOS: '/admin/empleados',
    VISTA_EMPLEADOS_ADMIN: '/admin/empleados',

    VISTA_CLIENTES: '/clientes',
    VISTA_CLIENTES_ADMIN: '/admin/clientes',

    VISTA_MASCOTAS: '/mascotas',
    VISTA_MASCOTAS_ADMIN: '/admin/mascotas',
    VISTA_MASCOTAS_EMPLEADO: '/empleado/mascotas',

    VISTA_RECETAS: '/recetas',
    VISTA_RECETAS_ADMIN: '/admin/recetas',
    VISTA_RECETAS_EMPLEADO: '/empleado/recetas',

    VISTA_HISTORIAS: '/historias-clinicas',
    VISTA_HISTORIAS_MASCOTA: '/historias-clinicas/mascota/:mascotaId',
    VISTA_HISTORIAS_CONSULTA: '/historias-clinicas/consulta/:consultaId',
    VISTA_HISTORIAS_ADMIN: '/admin/historias-clinicas',
    VISTA_HISTORIAS_MASCOTA_ADMIN: '/admin/historias-clinicas/mascota/:mascotaId',
    VISTA_HISTORIAS_CONSULTA_ADMIN: '/admin/historias-clinicas/consulta/:consultaId',
    VISTA_HISTORIAS_EMPLEADO: '/empleado/historias-clinicas',
    VISTA_HISTORIAS_MASCOTA_EMP: '/empleado/historias-clinicas/mascota/:mascotaId',
    VISTA_HISTORIAS_CONSULTA_EMP: '/empleado/historias-clinicas/consulta/:consultaId',

    VISTA_CITAS_AGENDA: '/citas/agenda',
    VISTA_CITAS_AGENDA_ADMIN: '/admin/citas/agenda',
    VISTA_CITAS_AGENDA_EMPLEADO: '/empleado/citas/agenda',

    VISTA_HORARIOS: '/admin/empleados/horarios',
    VISTA_HORARIOS_ADMIN: '/admin/empleados/horarios',
    VISTA_HORARIO_DETALLE: '/empleados/:id/horario',
    VISTA_HORARIO_DETALLE_ADMIN: '/admin/empleados/:id/horario',

    VISTA_MI_HORARIO: '/mi-horario',
    VISTA_MI_HORARIO_EMPLEADO: '/empleado/mi-horario',

    VISTA_PROFILE: '/profile',
    VISTA_PASSWORD_CHANGE: '/password-change',

    VISTA_APODERADO_PORTAL: '/apoderado',
    VISTA_APODERADO_DASHBOARD: '/apoderado/dashboard',

    VISTA_MIS_CITAS: '/apoderado/mis-citas',
    VISTA_MIS_CITAS_APODERADO: '/apoderado/mis-citas',

    VISTA_MIS_MASCOTAS: '/apoderado/mis-mascotas',
    VISTA_MIS_MASCOTAS_APODERADO: '/apoderado/mis-mascotas',

    VISTA_MI_HISTORIAL: '/mi-historial/:mascotaId',
    VISTA_MI_HISTORIAL_APODERADO: '/apoderado/mi-historial',

    VISTA_MIS_RECETAS: '/apoderado/mis-recetas',
    VISTA_MIS_RECETAS_APODERADO: '/apoderado/mis-recetas',

    VISTA_MIS_PAGOS: '/apoderado/mis-pagos',
    VISTA_MIS_PAGOS_APODERADO: '/apoderado/mis-pagos',

    VISTA_PAGOS: '/admin/pagos',
    VISTA_PAGOS_ADMIN: '/admin/pagos',
  };

  getRoute(codigo: string): string | null {
    return this.routeMap[codigo] || null;
  }

  getRouteOrDefault(codigo: string, defaultRoute: string = '/'): string {
    return this.routeMap[codigo] || defaultRoute;
  }
}
