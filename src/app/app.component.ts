import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProcessLoadingPanelComponent } from './shared/components/process-loading-panel/process-loading-panel.component';
import { AccessibilityWidgetComponent } from './shared/components/accessibility-widget/accessibility-widget.component';
import { AuthStore } from './store/auth.store';
import { effect } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { SOFTVET_FAVICON_URL, SOFTVET_NAME } from './core/constants/branding.constants';
import { BrandThemeService } from './core/services/brand-theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ProcessLoadingPanelComponent, AccessibilityWidgetComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly authStore = inject(AuthStore);
  private readonly titleService = inject(Title);
  private readonly brandTheme = inject(BrandThemeService);
  private readonly defaultFavicon = SOFTVET_FAVICON_URL;

  constructor() {
    effect(() => {
      const empresa = this.authStore.selectedEnterprise();
      const empresaSesion = !this.authStore.isSuperAdmin() ? this.authStore.companyName() : null;
      const nombre = empresa?.name || empresaSesion;

      this.brandTheme.applyCompanyColor(empresa?.colorPrimario);

      this.titleService.setTitle(nombre
        ? `${nombre} - Gestión clínica`
        : SOFTVET_NAME);
      this.actualizarFavicon(this.resolverLogo(empresa?.logoUrl) || this.defaultFavicon);
    });
  }

  private actualizarFavicon(url: string): void {
    let favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.removeAttribute('type');
    favicon.href = url;
  }

  private resolverLogo(path: string | null | undefined): string | null {
    if (!path) return null;
    return path.startsWith('http') ? path : `${environment.apiUrl}/media/${path}`;
  }
}
