import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LoadingStore } from '../../../store/loading.store';

@Component({
  selector: 'app-process-loading-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './process-loading-panel.component.html'
})
export class ProcessLoadingPanelComponent {
  readonly loadingStore = inject(LoadingStore);
}