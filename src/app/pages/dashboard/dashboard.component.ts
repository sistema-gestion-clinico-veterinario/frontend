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
  isSuperAdmin = this.roles.includes(Role.SUPER_ADMIN);
  isAdmin = this.roles.includes(Role.ADMIN);

  stats = signal<DashboardStats | null>(null);
  companies = signal<any[]>([]);
  selectedCompanyId: number | null = null;
  showPasswordModal = signal(
    !this.authStore.passwordChanged() &&
    sessionStorage.getItem('pw_modal_dismissed') !== '1'
  );

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
