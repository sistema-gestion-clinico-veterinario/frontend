import { CommonModule } from '@angular/common';
import { Component, inject, input, computed, signal, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../../store/auth.store';
import { MenuItemDTO, MenuStructureDTO } from '../../../models/response/auth-login-response.model';
import { RouteMapperService } from '../../../core/services/route-mapper.service';
import { MediaService } from '../../../core/services/media.service';
import { AuthService } from '../../../core/services/auth.service';
import { SkeletonModule } from 'primeng/skeleton';

interface MenuItemWithRuta extends MenuItemDTO {
  ruta: string;
}

interface MenuSection extends MenuStructureDTO {
  vistas: MenuItemWithRuta[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SkeletonModule],
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

  expandedSections = signal<Record<string, boolean>>({});
  companyLogoUrl = computed(() => this.authStore.selectedEnterprise()?.logoUrl ? this.mediaService.resolveUrl(this.authStore.selectedEnterprise()?.logoUrl) : null);

  userName = computed(() => this.authStore.nombreCompleto() ?? 'Usuario');
  companyName = computed(() => {
    const selectedEnterprise = this.authStore.selectedEnterprise();
    if (selectedEnterprise?.name) return selectedEnterprise.name;

    const companyName = this.authStore.companyName();
    if (companyName) return companyName;

    return this.authStore.isSuperAdmin() ? 'Vet Admin Pro' : '';
  });
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
        ? 'mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#123B5A] transition-colors duration-150'
        : 'mx-auto flex h-10 w-10 items-center justify-center rounded-md text-slate-200 hover:bg-white/10 hover:text-white transition-colors duration-150';
    }
    return isActive
      ? 'flex min-h-10 items-center rounded-md bg-white px-3 text-[#123B5A] transition-colors duration-150'
      : 'flex min-h-10 items-center rounded-md px-3 text-slate-200 hover:bg-white/10 hover:text-white transition-colors duration-150';
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
    this.authService.logout().subscribe({ error: () => {} });
    this.authStore.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
