import { CommonModule } from '@angular/common';
import { Component, inject, input, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Role } from '../../../core/enums/role.enum';
import { AuthStore } from '../../../store/auth.store';

interface NavItem {
  label: string;
  route: string;
  roles: string[];
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  collapsed = input(false);

  private authStore = inject(AuthStore);
  private router = inject(Router);

  userName = computed(() => this.authStore.nombreCompleto() ?? 'Usuario');
  companyName = computed(() => this.authStore.companyName() ?? 'VargasVet');
  roles = computed(() => this.authStore.roles() ?? []);

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      roles: [],
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      label: 'Mascotas',
      route: '/mascotas',
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA],
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
    },
    {
      label: 'Dueños',
      route: '/admin/clientes',
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA],
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
    },
    {
      label: 'Citas',
      route: '/citas/agenda',
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO, Role.RECEPCIONISTA],
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
    },
    {
      label: 'Historias Clínicas',
      route: '/historias-clinicas',
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.VETERINARIO],
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    },
    {
      label: 'Gestión Empresa',
      route: '/admin/company',
      roles: [Role.SUPER_ADMIN],
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
    },
    {
      label: 'Complementario',
      route: '/admin/complementario',
      roles: [Role.SUPER_ADMIN],
      icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z'
    },
    {
      label: 'Gestión Empleados',
      route: '/admin/empleados',
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
    }
  ];

  get visibleNavItems(): NavItem[] {
    return this.navItems.filter(
      item => item.roles.length === 0 || item.roles.some(r => this.roles().includes(r))
    );
  }

  navItemClass(isActive: boolean): string {
    const base = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${this.collapsed() ? 'justify-center' : ''}`;
    return isActive
      ? `${base} bg-[#0066AA] text-white shadow-sm`
      : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
  }

  logout() {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
