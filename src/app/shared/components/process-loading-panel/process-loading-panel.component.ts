
import { Component, inject } from '@angular/core';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { SOFTVET_LOGO_URL } from '../../../core/constants/branding.constants';

@Component({
  selector: 'app-process-loading-panel',
  standalone: true,
  imports: [],
  templateUrl: './process-loading-panel.component.html'
})
export class ProcessLoadingPanelComponent {
  readonly loadingStore = inject(LoadingStore);
  readonly authStore = inject(AuthStore);

  get loadingSrc(): string {
    return this.authStore.selectedEnterprise()?.logoUrl || SOFTVET_LOGO_URL;
  }
}
