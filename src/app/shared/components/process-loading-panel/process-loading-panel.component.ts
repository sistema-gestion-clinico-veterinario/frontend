import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';

const DEFAULT_LOADING_IMAGE = 'https://toqqwxveqxhlottwetev.supabase.co/storage/v1/object/public/vargas_vet/Fondo%20de%20Pantalla%20Computador%20Simple%20Beige%20(6)-Photoroom.png';

@Component({
  selector: 'app-process-loading-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './process-loading-panel.component.html'
})
export class ProcessLoadingPanelComponent {
  readonly loadingStore = inject(LoadingStore);
  readonly authStore = inject(AuthStore);

  get loadingSrc(): string {
    return this.authStore.selectedEnterprise()?.logoUrl || DEFAULT_LOADING_IMAGE;
  }
}