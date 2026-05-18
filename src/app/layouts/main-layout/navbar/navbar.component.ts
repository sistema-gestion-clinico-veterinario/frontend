import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, output, signal, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../../store/auth.store';
import { CompanyService } from '../../../core/services/company.service';
import { Role } from '../../../core/enums/role.enum';

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
  private router = inject(Router);

  companies = signal<{label: string, value: number}[]>([]);
  dropdownOpen = signal(false);

  get userName(): string { return this.authStore.nombreCompleto() ?? 'Usuario'; }
  get companyName(): string { return this.authStore.selectedEnterprise()?.name ?? this.authStore.companyName() ?? 'VargasVet'; }
  get userInitial(): string { return this.userName.charAt(0).toUpperCase(); }

  get isSuperAdmin(): boolean { return this.authStore.roles().includes(Role.SUPER_ADMIN); }
  get activeCompanyId(): number | null { return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId(); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('#user-menu-container')) {
      this.dropdownOpen.set(false);
    }
  }

  ngOnInit() {
    if (this.isSuperAdmin) {
      this.companyService.listar(0, 1000).subscribe({
        next: (res) => {
          const list = res.data.content.map(c => ({ label: c.name, value: c.id }));
          this.companies.set(list);

          if (!this.authStore.selectedEnterprise() && list.length > 0) {
            this.authStore.setSelectedEnterprise({ establishmentId: list[0].value, name: list[0].label });
          }
        }
      });
    }
  }

  onCompanyChange(event: any) {
    const selectedId = Number(event.target.value);
    const selectedCompany = this.companies().find(c => c.value === selectedId);

    if (selectedCompany) {
      this.authStore.setSelectedEnterprise({ establishmentId: selectedCompany.value, name: selectedCompany.label });
      const currentUrl = this.router.url;
      this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
        this.router.navigate([currentUrl]);
      });
    }
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
