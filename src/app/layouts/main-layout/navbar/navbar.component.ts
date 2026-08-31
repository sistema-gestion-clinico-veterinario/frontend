import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, output, signal, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthStore } from '../../../store/auth.store';
import { CompanyService } from '../../../core/services/company.service';
import { RoleService } from '../../../core/services/role.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role as CompanyRole } from '../../../models/response/permission';
import { AssignedRoleDTO, MenuItemDTO, MenuStructureDTO, RolePurpose } from '../../../models/response/auth-login-response.model';
import { SessionService } from '../../../core/services/session.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastModule],
  providers: [MessageService],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent implements OnInit {
  toggleSidebar = output<void>();

  authStore = inject(AuthStore);
  private companyService = inject(CompanyService);
  private roleService = inject(RoleService);
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  companies = signal<{label: string, value: number}[]>([]);
  companyRoles = signal<CompanyRole[]>([]);
  dropdownOpen = signal(false);
  companyDropdownOpen = signal(false);
  activeRoleDropdownOpen = signal(false);
  roleSwitching = signal(false);

  get userName(): string { return this.authStore.nombreCompleto() ?? 'Usuario'; }
  get companyName(): string { return this.authStore.selectedEnterprise()?.name ?? this.authStore.companyName() ?? 'VargasVet'; }
  get userInitial(): string { return this.userName.charAt(0).toUpperCase(); }

  get isSuperAdmin(): boolean { return this.authStore.isSuperAdmin(); }
  get activeCompanyId(): number | null { return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId(); }

  get activeCompanyLabel(): string {
    const activeId = this.activeCompanyId;
    if (!activeId && this.isSuperAdmin) return 'Todas las empresas';
    const found = this.companies().find(c => c.value === activeId);
    return found ? found.label : 'Seleccionar Empresa';
  }

  get activeRoleLabelText(): string {
    return this.getRoleLabel(this.authStore.activeRoleName() ?? '');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('#user-menu-container')) {
      this.dropdownOpen.set(false);
    }
    if (!target.closest('#company-dropdown-container')) {
      this.companyDropdownOpen.set(false);
    }

    if (!target.closest('#active-role-dropdown-container')) {
      this.activeRoleDropdownOpen.set(false);
    }
  }

  loadCompanyRoles(companyId: number) {
    this.roleService.listarPorEmpresa(companyId).subscribe({
      next: (res) => {
        this.companyRoles.set(res.data || []);
      }
    });
  }

  ngOnInit() {
    if (this.isSuperAdmin) {
      this.authStore.setLoadingEnterprise(true);
      this.companyService.listar(0, 1000).subscribe({
        next: (res) => {
          const companies = res.data?.content ?? [];
          const list = companies
            .filter(c => c.activo)
            .map(c => ({ label: c.name, value: c.id }));
          this.companies.set(list);

          const currentSelected = this.authStore.selectedEnterprise();
          if (currentSelected) {
            this.loadCompanyRoles(currentSelected.establishmentId);
          }
          this.authStore.setLoadingEnterprise(false);
        },
        error: () => {
          this.companies.set([]);
          this.authStore.setLoadingEnterprise(false);
        }
      });
    }
  }

  selectCompany(companyId: number) {
    const selectedCompany = this.companies().find(c => c.value === companyId);

    if (selectedCompany) {
      this.authStore.setSelectedEnterprise({ establishmentId: selectedCompany.value, name: selectedCompany.label });
      this.loadCompanyRoles(selectedCompany.value);

      const currentUrl = this.router.url;
      this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
        this.router.navigate([currentUrl]);
      });
    }
    this.companyDropdownOpen.set(false);
  }

  selectAllCompanies() {
    this.authStore.setSelectedEnterprise(null);
    this.companyRoles.set([]);
    this.companyDropdownOpen.set(false);

    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate([currentUrl]);
    });
  }

  toggleCompanyDropdown() {
    this.companyDropdownOpen.update(v => !v);
    if (this.companyDropdownOpen()) {
      this.activeRoleDropdownOpen.set(false);
      this.dropdownOpen.set(false);
    }
  }

  toggleActiveRoleDropdown() {
    if (this.roleSwitching()) return;
    this.activeRoleDropdownOpen.update(v => !v);
    if (this.activeRoleDropdownOpen()) {
      this.companyDropdownOpen.set(false);
      this.dropdownOpen.set(false);
    }
  }

  getRoleLabel(roleName: string): string {
    return roleName.replace(/^ROLE_/, '').replaceAll('_', ' ');
  }

  selectActiveRole(selectedRole: AssignedRoleDTO) {
    if (!selectedRole?.id || this.roleSwitching()) return;

    if (selectedRole.id === this.authStore.activeRoleId()) {
      this.activeRoleDropdownOpen.set(false);
      return;
    }

    this.roleSwitching.set(true);
    this.authService.switchRole(selectedRole.id).pipe(
      finalize(() => {
        this.roleSwitching.set(false);
        this.activeRoleDropdownOpen.set(false);
      })
    ).subscribe({
        next: (res) => {
          this.sessionService.establish(res.data, true);
          this.router.navigateByUrl(resolveInitialRoute(res.data.menu ?? [], res.data.activeRolePurpose), { replaceUrl: true });
        },
        error: (err) => {
          const msg = err.error?.message || 'No se pudo cambiar el rol';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        }
      });
  }

  toggleDropdown() {
    this.dropdownOpen.update(v => !v);
    if (this.dropdownOpen()) {
      this.companyDropdownOpen.set(false);
      this.activeRoleDropdownOpen.set(false);
    }
  }

  goToProfile() {
    this.dropdownOpen.set(false);
    this.router.navigate(['/profile']);
  }

  goToPasswordChange() {
    this.dropdownOpen.set(false);
    this.router.navigate(['/password-change']);
  }

  logout() {
    this.authService.logout().subscribe({ error: () => {} });
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}

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
