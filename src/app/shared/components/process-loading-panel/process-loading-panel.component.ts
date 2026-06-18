import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { LoadingStore } from '../../../store/loading.store';

@Component({
  selector: 'app-process-loading-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './process-loading-panel.component.html'
})
export class ProcessLoadingPanelComponent implements OnDestroy {
  readonly loadingStore = inject(LoadingStore);
  readonly visible = signal(false);
  readonly currentStep = signal(0);
  readonly progress = computed(() => {
    const total = this.loadingStore.processSteps().length || 1;
    return Math.round(((this.currentStep() + 1) / total) * 100);
  });

  private timerId: ReturnType<typeof setInterval> | null = null;
  private showDelayId: ReturnType<typeof setTimeout> | null = null;
  private readonly showDelayMs = 850;

  constructor() {
    effect(() => {
      if (this.loadingStore.showProcessPanel()) {
        this.scheduleShow();
      } else {
        this.hidePanel();
      }
    });
  }

  ngOnDestroy() {
    this.hidePanel();
  }

  isCompleted(index: number): boolean {
    return index < this.currentStep();
  }

  isActive(index: number): boolean {
    return index === this.currentStep();
  }

  private scheduleShow() {
    if (this.visible() || this.showDelayId) return;

    this.showDelayId = setTimeout(() => {
      this.showDelayId = null;
      if (!this.loadingStore.showProcessPanel()) return;

      this.visible.set(true);
      this.startProgress();
    }, this.showDelayMs);
  }

  private hidePanel() {
    if (this.showDelayId) {
      clearTimeout(this.showDelayId);
      this.showDelayId = null;
    }
    this.visible.set(false);
    this.stopProgress();
  }

  private startProgress() {
    if (this.timerId) return;

    this.currentStep.set(0);
    this.timerId = setInterval(() => {
      const lastIndex = Math.max(0, this.loadingStore.processSteps().length - 1);
      this.currentStep.update(step => Math.min(step + 1, lastIndex));
    }, 1300);
  }

  private stopProgress() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentStep.set(0);
  }
}
