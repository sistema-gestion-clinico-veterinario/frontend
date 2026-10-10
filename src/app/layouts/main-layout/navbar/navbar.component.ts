import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, output, signal, computed, HostListener, effect } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthStore } from '../../../store/auth.store';
import { CompanyService } from '../../../core/services/company.service';
import { RoleService } from '../../../core/services/role.service';
import { Role as CompanyRole } from '../../../models/response/permission';
import { AssignedRoleDTO } from '../../../models/response/auth-login-response.model';
import { SessionService } from '../../../core/services/session.service';
import { MediaService } from '../../../core/services/media.service';
import { PendientePrivacidad, PendientesPrivacidadService } from '../../../core/services/pendientes-privacidad.service';

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
  private sessionService = inject(SessionService);
  private mediaService = inject(MediaService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private pendientesService = inject(PendientesPrivacidadService);

  companies = signal<{
    label: string;
    value: number;
    ruc: string;
    logoUrl: string | null;
    colorPrimario: string | null;
  }[]>([]);
  companySearchTerm = signal('');
  companyRoles = signal<CompanyRole[]>([]);
  dropdownOpen = signal(false);
  companyDropdownOpen = signal(false);
  activeRoleDropdownOpen = signal(false);
  notificationsOpen = signal(false);
  roleSwitching = signal(false);

  readonly notifications = this.pendientesService.pendientes;

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

  /** Filtro client-side: la lista ya viene completa (hasta 1000 empresas en una sola
   * llamada), asi que no hace falta ida y vuelta al servidor para buscar mientras
   * se escribe - solo con superar unas pocas decenas de empresas ya no cabe todo
   * visible sin desplazarse, y dos empresas con nombres parecidos (ej. "Clinica
   * Veterinaria Vargas Vet" vs "Veterinaria Vargas Vet") son dificiles de distinguir
   * sin mas datos, por eso se muestra tambien el RUC. */
  filteredCompanies = computed(() => {
    const term = this.companySearchTerm().trim().toLowerCase();
    if (!term) return this.companies();
    return this.companies().filter(c =>
      c.label.toLowerCase().includes(term) || c.ruc.toLowerCase().includes(term));
  });

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
    if (!target.closest('#notifications-container')) {
      this.notificationsOpen.set(false);
    }
  }

  loadCompanyRoles(companyId: number) {
    this.roleService.listarPorEmpresa(companyId).subscribe({
      next: (res) => {
        this.companyRoles.set(res.data || []);
      }
    });
  }

  private readonly logoutErrorToast = effect(() => {
    const detail = this.sessionService.logoutError();
    if (detail) {
      this.messageService.add({ severity: 'error', summary: 'No se cerró la sesión', detail, life: 8000 });
    }
  });

  ngOnInit() {
    if (this.isSuperAdmin) {
      this.authStore.setLoadingEnterprise(true);
      this.companyService.listar(0, 1000).subscribe({
        next: (res) => {
          const companies = res.data?.content ?? [];
          const list = companies
            .filter(c => c.activo)
            .map(c => ({
              label: c.name,
              value: c.id,
              ruc: c.ruc ?? '',
              logoUrl: this.mediaService.resolveUrl(c.logoUrl),
              colorPrimario: c.colorPrimario ?? null,
            }));
          this.companies.set(list);

          const currentSelected = this.authStore.selectedEnterprise();
          if (currentSelected) {
            const refreshed = list.find(company => company.value === currentSelected.establishmentId);
            if (refreshed) {
              this.authStore.setSelectedEnterprise({
                establishmentId: refreshed.value,
                name: refreshed.label,
                logoUrl: refreshed.logoUrl ?? undefined,
                colorPrimario: refreshed.colorPrimario,
              });
            }
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
      this.authStore.setSelectedEnterprise({
        establishmentId: selectedCompany.value,
        name: selectedCompany.label,
        logoUrl: selectedCompany.logoUrl ?? undefined,
        colorPrimario: selectedCompany.colorPrimario,
      });
      this.loadCompanyRoles(selectedCompany.value);

      const currentUrl = this.router.url;
      this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
        this.router.navigate([currentUrl]);
      });
    }
    this.companyDropdownOpen.set(false);
    this.companySearchTerm.set('');
  }

  selectAllCompanies() {
    this.authStore.setSelectedEnterprise(null);
    this.companyRoles.set([]);
    this.companyDropdownOpen.set(false);
    this.companySearchTerm.set('');

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
    this.sessionService.changeRole(selectedRole.id).pipe(
      finalize(() => {
        this.roleSwitching.set(false);
        this.activeRoleDropdownOpen.set(false);
      })
    ).subscribe({
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
      this.notificationsOpen.set(false);
    }
  }

  toggleNotifications(): void {
    this.notificationsOpen.update(open => !open);
    if (this.notificationsOpen()) {
      this.dropdownOpen.set(false);
      this.companyDropdownOpen.set(false);
      this.activeRoleDropdownOpen.set(false);
      this.pendientesService.refrescar();
    }
  }

  openNotification(notification: PendientePrivacidad): void {
    this.notificationsOpen.set(false);
    this.router.navigate([notification.ruta], { fragment: notification.fragmento });
  }

  dismissNotification(notification: PendientePrivacidad, event: MouseEvent): void {
    event.stopPropagation();
    this.pendientesService.descartar(notification.id);
  }

  goToProfile() {
    this.dropdownOpen.set(false);
    this.router.navigate(['/profile']);
  }

  goToPasswordChange() {
    this.dropdownOpen.set(false);
    this.router.navigate(['/password-change']);
  }

  goToLegalAcceptance() {
    this.router.navigate(['/legal/accept']);
  }

  logout() {
    // El SlugUrlSerializer conoce el slug actual y lo antepone solo en la
    // barra de direcciones - al cerrar sesion se vuelve a la pantalla de
    // login marcada de la propia empresa, no al fallback generico.
    this.sessionService.logout();
  }
}

export { resolveDashboardRoute, resolveInitialRoute } from '../../../core/routing/initial-route';
