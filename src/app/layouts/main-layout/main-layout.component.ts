import { CommonModule } from '@angular/common';
import { Component, HostListener, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);

  toggleSidebar() {
    if (window.innerWidth < 1024) {
      this.mobileSidebarOpen.update(v => !v);
      return;
    }

    this.sidebarCollapsed.update(v => !v);
  }

  closeMobileSidebar() {
    this.mobileSidebarOpen.set(false);
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 1024) {
      this.mobileSidebarOpen.set(false);
    }
  }
}