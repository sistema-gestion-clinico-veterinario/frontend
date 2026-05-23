import { CommonModule } from '@angular/common';
import { Component, inject, input, computed, signal, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../../store/auth.store';
import { MenuItemDTO, MenuStructureDTO } from '../../../models/response/auth-login-response.model';
import { RouteMapperService } from '../../../core/services/route-mapper.service';

interface MenuItemWithRuta extends MenuItemDTO {
  ruta: string;
}

interface MenuSection extends MenuStructureDTO {
  vistas: MenuItemWithRuta[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  collapsed = input(false);
  toggleSidebar = output<void>();

  private authStore = inject(AuthStore);
  private router = inject(Router);
  private routeMapper = inject(RouteMapperService);

  expandedSections = signal<Record<string, boolean>>({});

  userName = computed(() => this.authStore.nombreCompleto() ?? 'Usuario');
  companyName = computed(() => this.authStore.companyName() ?? '');

  toggleSection(ventanaId: number | undefined) {
    const key = String(ventanaId ?? 'default');
    this.expandedSections.update(state => ({
      ...state,
      [key]: !state[key]
    }));
  }

  isSectionExpanded(structure: MenuSection): boolean {
    const key = String(structure.ventanaId ?? 'default');
    const userToggled = this.expandedSections()[key];
    if (userToggled !== undefined) {
      return userToggled;
    }

    // Collapse by default, but auto-expand if one of the inner views is active
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
      const isMenuStructure = (obj: any): obj is MenuStructureDTO => {
        return obj && typeof obj === 'object' && 'vistas' in obj && Array.isArray(obj.vistas);
      };

      if (isMenuStructure(item)) {
        const vistasConRuta: MenuItemWithRuta[] = item.vistas.map(vista => ({
          ...vista,
          ruta: vista.ruta || this.routeMapper.getRoute(vista.codigo) || '/'
        }));

        structures.push({
          ...item,
          vistas: vistasConRuta
        });
      } else {
        const vistaItem = item as MenuItemDTO;
        structures.push({
          ventanaId: undefined,
          ventanaNombre: vistaItem.nombre,
          grupo: vistaItem.grupo,
          orden: vistaItem.orden || 0,
          vistas: [{
            ...vistaItem,
            ruta: vistaItem.ruta || this.routeMapper.getRoute(vistaItem.codigo) || '/'
          }]
        });
      }
    }

    return structures.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  });

  navItemClass(isActive: boolean): string {
    const isCollapsed = this.collapsed();
    const base = `flex items-center rounded-xl transition-all duration-200 ease-in-out ${isCollapsed ? 'justify-center w-11 h-11 mx-auto' : 'px-3 py-2.5'}`;

    if (isActive) {
      return `${base} bg-[#EFF6FF] text-[#0066AA] font-semibold`;
    }

    return `${base} text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]`;
  }

  sectionIcon(structure: MenuSection): string {
    const code = structure.ventanaCodigo || structure.grupo || structure.ventanaNombre;
    const icons: Record<string, string> = {
      ADMINISTRACION: 'pi pi-cog',
      ADMIN: 'pi pi-cog',
      PERSONAL: 'pi pi-id-card',
      RRHH: 'pi pi-id-card',
      CLINICA: 'pi pi-heart',
      PORTAL_APODERADO: 'pi pi-user',
      APODERADO: 'pi pi-user'
    };

    return icons[code || ''] || 'pi pi-folder';
  }

  vistaIcon(codigo: string): string {
    const icons: Record<string, string> = {
      VISTA_DASHBOARD: 'pi pi-home',
      VISTA_COMPANY: 'pi pi-building',
      VISTA_AUDITORIA_ADMIN: 'pi pi-list-check',
      VISTA_ROLES: 'pi pi-shield',
      VISTA_VENTANAS: 'pi pi-sitemap',
      VISTA_COMPLEMENTARIO: 'pi pi-database',
      VISTA_PAGOS: 'pi pi-wallet',
      VISTA_EMPLEADOS: 'pi pi-users',
      VISTA_HORARIOS: 'pi pi-calendar-clock',
      VISTA_MI_HORARIO: 'pi pi-clock',
      VISTA_CLIENTES: 'pi pi-address-book',
      VISTA_MASCOTAS: 'pi pi-heart',
      VISTA_RECETAS: 'pi pi-file-edit',
      VISTA_HISTORIAS: 'pi pi-folder-open',
      VISTA_CITAS_AGENDA: 'pi pi-calendar',
      VISTA_APODERADO_DASHBOARD: 'pi pi-chart-line',
      VISTA_MIS_MASCOTAS: 'pi pi-heart-fill',
      VISTA_MIS_CITAS: 'pi pi-calendar-plus',
      VISTA_MI_HISTORIAL: 'pi pi-book',
      VISTA_MIS_PAGOS: 'pi pi-credit-card',
      VISTA_PROFILE: 'pi pi-user'
    };

    return icons[codigo] || 'pi pi-circle';
  }

  logout() {
    this.authStore.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
