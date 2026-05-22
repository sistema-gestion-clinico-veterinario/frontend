import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, output, signal, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../store/auth.store';
import { CompanyService } from '../../../core/services/company.service';
import { RoleService } from '../../../core/services/role.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/enums/role.enum';
import { Role as CompanyRole } from '../../../models/response/permission';
import { MenuItemDTO, MenuStructureDTO } from '../../../models/response/auth-login-response.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent implements OnInit {
  toggleSidebar = output<void>();

  authStore = inject(AuthStore);
  private companyService = inject(CompanyService);
  private roleService = inject(RoleService);
  private authService = inject(AuthService);
  private router = inject(Router);

  companies = signal<{label: string, value: number}[]>([]);
  companyRoles = signal<CompanyRole[]>([]);
  dropdownOpen = signal(false);
  companyDropdownOpen = signal(false);
  activeRoleDropdownOpen = signal(false);

  get userName(): string { return this.authStore.nombreCompleto() ?? 'Usuario'; }
  get companyName(): string { return this.authStore.selectedEnterprise()?.name ?? this.authStore.companyName() ?? 'VargasVet'; }
  get userInitial(): string { return this.userName.charAt(0).toUpperCase(); }

  get isSuperAdmin(): boolean { return this.authStore.originalRoles().includes(Role.SUPER_ADMIN); }
  get activeCompanyId(): number | null { return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId(); }

  get activeCompanyLabel(): string {
    const activeId = this.activeCompanyId;
    const found = this.companies().find(c => c.value === activeId);
    return found ? found.label : 'Seleccionar Empresa';
  }

  get activeRoleLabelText(): string {
    const role = this.authStore.roles()[0];
    return this.getRoleLabel(role);
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
      this.companyService.listar(0, 1000).subscribe({
        next: (res) => {
          const companies = res.data?.content ?? [];
          const list = companies
            .filter(c => c.activo)
            .map(c => ({ label: c.name, value: c.id }));
          this.companies.set(list);

          const currentSelected = this.authStore.selectedEnterprise();
          if (!currentSelected && list.length > 0) {
            const firstCompany = list[0];
            this.authStore.setSelectedEnterprise({ establishmentId: firstCompany.value, name: firstCompany.label });
            this.loadCompanyRoles(firstCompany.value);
          } else if (currentSelected) {
            this.loadCompanyRoles(currentSelected.establishmentId);
          }
        },
        error: () => {
          this.companies.set([]);
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



  getRoleLabel(roleName: string): string {
    const mapping: Record<string, string> = {
      'ROLE_SUPER_ADMIN': 'Super Administrador',
      'ROLE_ADMIN': 'Administrador',
      'ROLE_VETERINARIO': 'Veterinario',
      'ROLE_APODERADO': 'Apoderado',
      'ROLE_GROOMER': 'Estilista (Groomer)',
      'ROLE_RECEPCIONISTA': 'Recepcionista'
    };
    return mapping[roleName] || roleName.replace('ROLE_', '');
  }

  selectActiveRole(selectedRole: string) {
    if (selectedRole) {
      this.authService.switchRole(selectedRole).subscribe({
        next: (res) => {
          this.authStore.setAuth({
            token: res.data.token,
            refreshToken: res.data.refreshToken,
            roles: res.data.roles,
            companyId: res.data.companyId,
            companyName: res.data.companyName,
            nombreCompleto: res.data.nombreCompleto,
            userType: res.data.userType,
            empleadoId: res.data.empleadoId,
            passwordChanged: res.data.passwordChanged,
            needsCompanySelection: res.data.needsCompanySelection,
            selectedEnterprise: this.authStore.selectedEnterprise(),
            menu: res.data.menu,
            simulatedRoleId: this.authStore.simulatedRoleId(),
            originalMenu: res.data.menu,
            assignedRoles: res.data.assignedRoles || this.authStore.assignedRoles()
          });

          window.location.href = resolveInitialRoute(res.data.roles ?? [], res.data.menu ?? []);
        }
      });
    }
    this.activeRoleDropdownOpen.set(false);
  }

  toggleDropdown() {
    this.dropdownOpen.update(v => !v);
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
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}

export function resolveDashboardRoute(roles: string[]): string {
  if (roles.includes('ROLE_SUPER_ADMIN') || roles.includes('SUPER_ADMIN')) return '/dashboard';

  const role = roles[0] ?? '';
  if (role.includes('APODERADO') || role.includes('CLIENTE')) return '/apoderado/dashboard';
  if (role.includes('ADMIN')) return '/admin/dashboard';
  return '/empleado/dashboard';
}

export function resolveInitialRoute(roles: string[], menu: (MenuStructureDTO | MenuItemDTO)[]): string {
  return resolveDashboardRoute(roles);
}

function findFirstMenuRoute(menu: (MenuStructureDTO | MenuItemDTO)[]): string | null {
  for (const item of menu || []) {
    if (isMenuStructure(item)) {
      const vista = item.vistas.find(v => (v.activo ?? true) && !!v.ruta);
      if (vista?.ruta) return vista.ruta;
      continue;
    }

    if ((item.activo ?? true) && item.ruta) return item.ruta;
  }

  return null;
}

function isMenuStructure(item: MenuStructureDTO | MenuItemDTO): item is MenuStructureDTO {
  return 'vistas' in item && Array.isArray(item.vistas);
}
