
import { Component, ElementRef, HostListener, ViewChild, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { ChangePasswordModalComponent } from './change-password-modal/change-password-modal.component';
import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { GuidedTourOverlayComponent } from '../../shared/components/guided-tour-overlay/guided-tour-overlay.component';

const PASSWORD_MODAL_DISMISSED_KEY = 'pw_modal_dismissed';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent, ChangePasswordModalComponent, GuidedTourOverlayComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  // Estas hojas son globales por diseño, pero se descargan solo después de
  // autenticar, cuando se carga el layout que realmente utiliza sus clases.
  encapsulation: ViewEncapsulation.None
})
export class MainLayoutComponent {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;

  private readonly authStore = inject(AuthStore);

  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);

  private readonly passwordModalDismissed = signal(sessionStorage.getItem(PASSWORD_MODAL_DISMISSED_KEY) === '1');
  readonly showPasswordModal = computed(() =>
    this.authStore.sessionStatus() === 'authenticated'
    && !this.authStore.passwordChanged()
    && !this.passwordModalDismissed()
  );

  dismissPasswordModal() {
    sessionStorage.setItem(PASSWORD_MODAL_DISMISSED_KEY, '1');
    this.passwordModalDismissed.set(true);
  }

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

  @HostListener('window:softvet-tour-close-mobile-sidebar')
  closeMobileSidebarForTour(): void {
    this.closeMobileSidebar();
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 1024) {
      this.mobileSidebarOpen.set(false);
    }
  }
}
