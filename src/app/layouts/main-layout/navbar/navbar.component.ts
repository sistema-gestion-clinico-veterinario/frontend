import { CommonModule } from '@angular/common';
import { Component, inject, output } from '@angular/core';
import { AuthStore } from '../../../store/auth.store';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  toggleSidebar = output<void>();

  private authStore = inject(AuthStore);

  userName = this.authStore.nombreCompleto() ?? 'Usuario';
  companyName = this.authStore.companyName() ?? 'VargasVet';

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase();
  }
}
