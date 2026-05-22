import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {
  sidebarCollapsed = signal(true);

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }
}
