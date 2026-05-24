import { Component, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

const MOBILE_BREAKPOINT = 1024;

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = signal(false);

  ngOnInit() {
    this.sidebarCollapsed.set(window.innerWidth < MOBILE_BREAKPOINT);
  }

  ngOnDestroy() {}

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      this.sidebarCollapsed.set(true);
    } else {
      this.sidebarCollapsed.set(false);
    }
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }
}
