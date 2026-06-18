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
  readonly currentStep = signal(0);
  readonly progress = computed(() => {
    const total = this.loadingStore.processSteps().length || 1;
    return Math.round(((this.currentStep() + 1) / total) * 100);
  });

  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.loadingStore.isLoading()) {
        this.startProgress();
      } else {
        this.stopProgress();
      }
    });
  }

  ngOnDestroy() {
    this.stopProgress();
  }

  isCompleted(index: number): boolean {
    return index < this.currentStep();
  }

  isActive(index: number): boolean {
    return index === this.currentStep();
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