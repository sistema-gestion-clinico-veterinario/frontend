import { CommonModule } from '@angular/common';
import { Component, inject, input, computed, signal, output, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../../store/auth.store';
import { MenuItemDTO, MenuStructureDTO } from '../../../models/response/auth-login-response.model';
import { RouteMapperService } from '../../../core/services/route-mapper.service';
import { CompanyService } from '../../../core/services/company.service';
import { MediaService } from '../../../core/services/media.service';

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
export class SidebarComponent implements OnInit {
  collapsed = input(false);
  toggleSidebar = output<void>();
  navigate = output<void>();

  private authStore = inject(AuthStore);
  private router = inject(Router);
  private routeMapper = inject(RouteMapperService);
  private companyService = inject(CompanyService);
  private mediaService = inject(MediaService);

  expandedSections = signal<Record<string, boolean>>({});
  companyLogoUrl = signal<string | null>(null);

  userName = computed(() => this.authStore.nombreCompleto() ?? 'Usuario');
  companyName = computed(() => this.authStore.companyName() ?? '');

  userInitials = computed(() => {
    const name = this.authStore.nombreCompleto() ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase() || 'U';
  });

  userRole = computed(() => {
    const roles = this.authStore.roles() ?? [];
    const role = roles[0] ?? '';
    const map: Record<string, string> = {
      ADMIN: 'Administrador', ROLE_ADMIN: 'Administrador',
      SUPER_ADMIN: 'Super Admin', ROLE_SUPER_ADMIN: 'Super Admin',
      VETERINARIO: 'Veterinario', ROLE_VETERINARIO: 'Veterinario',
      RECEPCIONISTA: 'Recepcionista', ROLE_RECEPCIONISTA: 'Recepcionista',
      APODERADO: 'Apoderado', ROLE_APODERADO: 'Apoderado',
      GROMMER: 'Groomer', ROLE_GROMMER: 'Groomer',
    };
    return map[role] || role;
  });

  ngOnInit() {
    const companyId = this.authStore.companyId();
    if (companyId) {
      this.companyService.getById(companyId).subscribe({
        next: (res) => {
          if (res.data?.logoUrl) {
            this.companyLogoUrl.set(this.mediaService.resolveUrl(res.data.logoUrl));
          }
        }
      });
    }
  }

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
          .map(v => ({ ...v, ruta: v.ruta || this.routeMapper.getRoute(v.codigo) || '/' }));

        if (vistasConRuta.length === 0) continue;
        structures.push({ ...item, vistas: vistasConRuta });
      } else {
        const vistaItem = item as MenuItemDTO;
        if (vistaItem.leer === false) continue;
        structures.push({
          ventanaId: undefined,
          ventanaNombre: vistaItem.nombre,
          grupo: vistaItem.grupo,
          orden: vistaItem.orden || 0,
          vistas: [{ ...vistaItem, ruta: vistaItem.ruta || this.routeMapper.getRoute(vistaItem.codigo) || '/' }]
        });
      }
    }
    return structures.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  });

  navItemClass(isActive: boolean): string {
    if (this.collapsed()) {
      return isActive
        ? 'flex items-center justify-center mx-auto w-10 h-10 rounded-md bg-slate-100 transition-colors duration-150'
        : 'flex items-center justify-center mx-auto w-10 h-10 rounded-md hover:bg-slate-50 transition-colors duration-150';
    }
    return isActive
      ? 'flex items-center border-l-2 border-[#0057B8] bg-slate-50 pl-[16px] pr-4 py-[9px] transition-colors duration-150'
      : 'flex items-center border-l-2 border-transparent pl-[16px] pr-4 py-[9px] hover:bg-slate-50 transition-colors duration-150';
  }

  getIcon(vista: MenuItemWithRuta): string {
    if (vista.icono) return `pi ${vista.icono}`;
    return this.vistaIcon(vista.codigo);
  }

  sectionIcon(structure: MenuSection): string {
    const first = structure.vistas[0];
    return first ? this.getIcon(first) : 'pi pi-folder';
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
      VISTA_CAJA: 'pi pi-money-bill',
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
      VISTA_MIS_RECETAS: 'pi pi-file-edit',
      VISTA_MIS_PAGOS: 'pi pi-credit-card',
      VISTA_PROFILE: 'pi pi-user',
    };
    return icons[codigo] || 'pi pi-circle';
  }

  logout() {
    this.authStore.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
