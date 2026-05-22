import { CommonModule } from '@angular/common';
import { Component, inject, input, computed, signal, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../../store/auth.store';
import { MenuItemDTO } from '../../../models/response/auth-login-response.model';

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

  userName = computed(() => this.authStore.nombreCompleto() ?? 'Usuario');
  companyName = computed(() => this.authStore.companyName() ?? '');

  menuItems = computed(() => {
    return this.authStore.menu() || [];
  });

  expandedMenus = signal<Set<number>>(new Set());

  toggleSubmenu(id: number, event: Event) {
    event.stopPropagation();

    if (this.collapsed()) {
      this.toggleSidebar.emit();
      const newSet = new Set(this.expandedMenus());
      newSet.add(id);
      this.expandedMenus.set(newSet);
      return;
    }

    const newSet = new Set(this.expandedMenus());
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    this.expandedMenus.set(newSet);
  }

  isMenuOpen(id: number): boolean {
    return this.expandedMenus().has(id);
  }

  navItemClass(isActive: boolean, level: number = 0): string {
    const isCollapsed = this.collapsed();
    const base = `flex items-center rounded-xl transition-all duration-300 ease-in-out ${isCollapsed ? 'justify-center w-12 h-12 mx-auto' : 'px-2 py-2'}`;

    if (isActive) {
      return `${base} text-[#0F172A] font-medium`;
    }

    return `${base} text-[#64748B] hover:text-[#0F172A]`;
  }

  logout() {
    this.authStore.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
