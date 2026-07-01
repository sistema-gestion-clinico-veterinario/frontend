import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProcessLoadingPanelComponent } from './shared/components/process-loading-panel/process-loading-panel.component';
import { AuthStore } from './store/auth.store';
import { effect } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ProcessLoadingPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly authStore = inject(AuthStore);

  constructor() {
    effect(() => {
      const name = this.authStore.selectedEnterprise()?.name || this.authStore.companyName();
      if (name) {
        document.title = `${name} - Sistema de Gestión`;
      }
    });
  }
}