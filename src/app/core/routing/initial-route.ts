import { MenuItemDTO, MenuStructureDTO, RolePurpose } from '../../models/response/auth-login-response.model';

export function resolveDashboardRoute(purpose?: RolePurpose | null): string {
  if (purpose === 'PLATFORM_ADMIN') return '/dashboard';
  if (purpose === 'COMPANY_ADMIN') return '/admin/dashboard';
  if (purpose === 'CLIENT_PORTAL') return '/apoderado/dashboard';
  return '/empleado/dashboard';
}

export function resolveInitialRoute(menu: (MenuStructureDTO | MenuItemDTO)[], purpose?: RolePurpose | null): string {
  const menuRoute = findFirstMenuRoute(menu);
  return menuRoute ? normalizeInitialRoute(menuRoute) : resolveDashboardRoute(purpose);
}

function findFirstMenuRoute(menu: (MenuStructureDTO | MenuItemDTO)[]): string | null {
  for (const item of menu || []) {
    if (isMenuStructure(item)) {
      const vista = item.vistas.find(v => (v.activo ?? true) && v.leer !== false && !!v.ruta);
      if (vista?.ruta) return vista.ruta;
      continue;
    }

    if ((item.activo ?? true) && item.leer !== false && item.ruta) return item.ruta;
  }

  return null;
}

function normalizeInitialRoute(route: string): string {
  return route.startsWith('/') ? route : `/${route}`;
}

function isMenuStructure(item: MenuStructureDTO | MenuItemDTO): item is MenuStructureDTO {
  return 'vistas' in item && Array.isArray(item.vistas);
}
