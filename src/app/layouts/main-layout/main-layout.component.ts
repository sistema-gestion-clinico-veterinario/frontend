import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;

  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);

  constructor() {
    // El contenido se desplaza dentro de este <main>, no en la ventana, por lo
    // que scrollPositionRestoration del Router (que solo controla window) no
    // alcanza a resetearlo. Se hace manualmente en cada cambio de ruta.
    const router = inject(Router);
    router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.scrollContainer?.nativeElement.scrollTo({ top: 0 });
      });
  }

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