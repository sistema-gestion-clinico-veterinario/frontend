
import { Component, inject, input, computed, signal, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../../store/auth.store';
import { MenuItemDTO, MenuStructureDTO } from '../../../models/response/auth-login-response.model';
import { RouteMapperService } from '../../../core/services/route-mapper.service';
import { MediaService } from '../../../core/services/media.service';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { SkeletonModule } from 'primeng/skeleton';
import {
  SOFTVET_LOGO_URL,
  SOFTVET_SIDEBAR_NAME,
  SOFTVET_SIDEBAR_SUBTITLE
} from '../../../core/constants/branding.constants';

interface MenuItemWithRuta extends MenuItemDTO {
  ruta: string;
}

interface MenuSection extends MenuStructureDTO {
  vistas: MenuItemWithRuta[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SkeletonModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  collapsed = input(false);
  toggleSidebar = output<void>();
  navigate = output<void>();

  private authStore = inject(AuthStore);
  private router = inject(Router);
  private routeMapper = inject(RouteMapperService);
  private mediaService = inject(MediaService);
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);

  expandedSections = signal<Record<string, boolean>>({});
  companyLogoUrl = computed(() => this.authStore.selectedEnterprise()?.logoUrl
    ? this.mediaService.resolveUrl(this.authStore.selectedEnterprise()?.logoUrl)
    : SOFTVET_LOGO_URL);

  userName = computed(() => this.authStore.nombreCompleto() ?? 'Usuario');
  hasCompany = computed(() => Boolean(
    this.authStore.selectedEnterprise()?.name?.trim()
      || this.authStore.companyName()?.trim()
  ));
  companyName = computed(() => {
    const selectedEnterprise = this.authStore.selectedEnterprise();
    if (selectedEnterprise?.name) return selectedEnterprise.name;

    const companyName = this.authStore.companyName();
    if (companyName) return companyName;

    return SOFTVET_SIDEBAR_NAME;
  });
  companySubtitle = computed(() => this.hasCompany() ? null : SOFTVET_SIDEBAR_SUBTITLE);
  loadingEnterprise = computed(() => this.authStore.loadingEnterprise());

  userInitials = computed(() => {
    const name = this.authStore.nombreCompleto() ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase() || 'U';
  });

  userRole = computed(() => {
    return (this.authStore.activeRoleName() ?? '')
      .replace(/^ROLE_/, '')
      .replaceAll('_', ' ');
  });

  private sectionKey(structure: MenuSection): string {
    return structure.ventanaNombre || structure.grupo || 'default';
  }

  toggleSection(structure: MenuSection) {
    const key = this.sectionKey(structure);
    this.expandedSections.update(state => ({ ...state, [key]: !state[key] }));
  }

  isSectionExpanded(structure: MenuSection): boolean {
    const key = this.sectionKey(structure);
    const toggled = this.expandedSections()[key];
    if (toggled !== undefined) return toggled;

    const currentUrl = this.router.url.split('?')[0];
    return structure.vistas.some(vista => {
      const vRuta = vista.ruta.startsWith('/') ? vista.ruta : '/' + vista.ruta;
      const cUrl = currentUrl.startsWith('/') ? currentUrl : '/' + currentUrl;
      return cUrl === vRuta;
    });
  }

  menuStructure = computed(() => {
    const menu = this.authStore.menu() || [];
    const structures: MenuSection[] = [];

    for (const item of menu) {
      const isMenuStructure = (obj: any): obj is MenuStructureDTO =>
        obj && typeof obj === 'object' && 'vistas' in obj && Array.isArray(obj.vistas);

      if (isMenuStructure(item)) {
        const vistasConRuta: MenuItemWithRuta[] = item.vistas
          .filter(v => v.leer !== false)
          .flatMap(v => {
            const ruta = this.routeMapper.getRoute(v.codigo);
            return ruta ? [{ ...v, ruta }] : [];
          });

        if (vistasConRuta.length === 0) continue;
        structures.push({ ...item, vistas: vistasConRuta });
      } else {
        const vistaItem = item as MenuItemDTO;
        if (vistaItem.leer === false) continue;
        const ruta = this.routeMapper.getRoute(vistaItem.codigo);
        if (!ruta) continue;
        structures.push({
          ventanaId: undefined,
          ventanaNombre: vistaItem.nombre,
          grupo: vistaItem.grupo,
          orden: vistaItem.orden || 0,
          vistas: [{ ...vistaItem, ruta }]
        });
      }
    }
    return structures.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  });

  navItemClass(isActive: boolean): string {
    if (this.collapsed()) {
      return isActive
        ? 'mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-700 transition-colors duration-150'
        : 'mx-auto flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-blue-100/70 hover:text-blue-600 transition-colors duration-150';
    }
    return isActive
      ? 'flex min-h-10 items-center rounded-md bg-blue-100 px-3 text-blue-700 transition-colors duration-150'
      : 'flex min-h-10 items-center rounded-md px-3 text-slate-600 hover:bg-blue-100/70 hover:text-blue-600 transition-colors duration-150';
  }

  isGrouped(structure: MenuSection): boolean {
    return structure.presentacion === 'GROUPED'
      || (structure.presentacion == null && structure.vistas.length > 1);
  }

  getIcon(vista: MenuItemWithRuta): string {
    return this.routeMapper.getIcon(vista.codigo);
  }

  sectionIcon(structure: MenuSection): string {
    if (structure.ventanaIcono) return `pi ${structure.ventanaIcono}`;
    const first = structure.vistas[0];
    return first ? this.getIcon(first) : 'pi pi-folder';
  }

  logout() {
    // El SlugUrlSerializer conoce el slug actual y lo antepone solo en la
    // barra de direcciones - al cerrar sesion se vuelve a la pantalla de
    // login marcada de la propia empresa, no al fallback generico.
    this.sessionService.logout();
  }
}
