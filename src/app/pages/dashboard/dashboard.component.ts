import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { CompanyService } from '../../core/services/company.service';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { Role } from '../../core/enums/role.enum';
import { LoadingStore } from '../../store/loading.store';
import { ChangePasswordModalComponent } from '../../layouts/main-layout/change-password-modal/change-password-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DropdownModule, FormsModule, RouterModule, ChangePasswordModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private authStore = inject(AuthStore);
  private dashboardService = inject(DashboardService);
  private companyService = inject(CompanyService);
  private loadingStore = inject(LoadingStore);
  private router = inject(Router);

  userName = this.authStore.nombreCompleto() ?? '';
  roles = this.authStore.roles() ?? [];
  permissions = this.authStore.permissions() ?? [];
  isSuperAdmin   = this.roles.includes(Role.SUPER_ADMIN);
  isAdmin        = this.roles.includes(Role.ADMIN);
  isVeterinario  = this.roles.includes(Role.VETERINARIO);
  isRecepcionista = this.roles.includes(Role.RECEPCIONISTA);

  readonly today       = new Date();
  readonly companyName = this.authStore.companyName() ?? '';

  stats = signal<DashboardStats | null>(null);
  companies = signal<any[]>([]);
  selectedCompanyId: number | null = null;
  showPasswordModal = signal(
    !this.authStore.passwordChanged() &&
    sessionStorage.getItem('pw_modal_dismissed') !== '1'
  );

  get userInitials(): string {
    return (this.userName ?? '')
      .split(' ')
      .slice(0, 2)
      .map(n => n[0] ?? '')
      .join('')
      .toUpperCase();
  }

  get dayGreeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get rolePrincipal(): string {
    if (this.isSuperAdmin)   return 'Super Administrador';
    if (this.isAdmin)        return 'Administrador';
    if (this.isVeterinario)  return 'Veterinario';
    if (this.isRecepcionista) return 'Recepcionista';
    return this.roles[0]?.replace('ROLE_', '') ?? 'Usuario';
  }

  get roleBadgeClass(): string {
    if (this.isSuperAdmin)   return 'bg-violet-50 text-violet-700 border border-violet-100';
    if (this.isAdmin)        return 'bg-blue-50 text-[#0066AA] border border-blue-100';
    if (this.isVeterinario)  return 'bg-teal-50 text-teal-700 border border-teal-100';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }

  get quickActions(): { label: string; icon: string; route: string }[] {
    const actions: { label: string; icon: string; route: string }[] = [
      { label: 'Agenda',           icon: 'pi-calendar',  route: '/citas/agenda'         },
      { label: 'Mascotas',         icon: 'pi-heart',     route: '/mascotas'             },
      { label: 'Historias Clín.', icon: 'pi-folder',    route: '/historias-clinicas'   },
      { label: 'Recetas',          icon: 'pi-file',      route: '/recetas'              },
    ];
    if (this.isSuperAdmin || this.isAdmin || this.isRecepcionista)
      actions.push({ label: 'Clientes',  icon: 'pi-users',    route: '/admin/clientes'  });
    if (this.isSuperAdmin || this.isAdmin)
      actions.push({ label: 'Empleados', icon: 'pi-id-card',  route: '/admin/empleados' });
    if (this.isSuperAdmin)
      actions.push({ label: 'Empresas',  icon: 'pi-building', route: '/admin/company'   });
    return actions;
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  permissionLabel(perm: string): string {
    const map: Record<string, string> = {
      EMPLOYEE_READ: 'Ver Personal',       EMPLOYEE_MANAGE: 'Gestionar Personal',
      CLIENT_READ: 'Ver Clientes',         CLIENT_MANAGE: 'Gestionar Clientes',
      APPOINTMENT_READ: 'Ver Citas',       APPOINTMENT_MANAGE: 'Gestionar Citas',
      CLINICAL_RECORD_READ: 'Ver HC',      CLINICAL_RECORD_MANAGE: 'Gestionar HC',
      COMPANY_READ: 'Ver Empresa',         COMPANY_MANAGE: 'Gestionar Empresa',
      ROLE_READ: 'Ver Roles',              ROLE_MANAGE: 'Gestionar Roles',
      SERVICE_READ: 'Ver Servicios',       SERVICE_MANAGE: 'Gestionar Servicios',
      PAYMENT_READ: 'Ver Pagos',           PAYMENT_MANAGE: 'Gestionar Pagos',
    };
    return map[perm] ?? perm.replace(/_/g, ' ').toLowerCase();
  }

  dismissPasswordModal() {
    sessionStorage.setItem('pw_modal_dismissed', '1');
    this.showPasswordModal.set(false);
  }

  ngOnInit() {
    if (this.isSuperAdmin) {
      this.loadCompanies();
    }
    this.loadStats();
  }

  loadCompanies() {
    this.companyService.listar(0, 1000).subscribe({
      next: (res) => {
        const list = res.data.content.map(c => ({ label: c.name, value: c.id }));
        this.companies.set([{ label: 'Todas las sedes', value: null }, ...list]);
      }
    });
  }

  loadStats() {
    this.loadingStore.show();
    this.dashboardService.getStats(this.selectedCompanyId || undefined).subscribe({
      next: (res) => {
        this.stats.set(res.data);
        this.loadingStore.hide();
      },
      error: () => {
        this.loadingStore.hide();
      }
    });
  }

  logout() {
    this.authStore.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
