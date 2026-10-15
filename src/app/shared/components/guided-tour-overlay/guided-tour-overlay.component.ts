import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { GuidedTourService, TourTargetRect } from '../../../core/services/guided-tour.service';

@Component({
  selector: 'app-guided-tour-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tour.active() && tour.targetRect(); as target) {
      <div class="fixed inset-x-0 top-0 z-[500] bg-slate-950/55" [ngStyle]="topMask(target)"></div>
      <div class="fixed bottom-0 left-0 z-[500] bg-slate-950/55" [ngStyle]="bottomMask(target)"></div>
      <div class="fixed left-0 z-[500] bg-slate-950/55" [ngStyle]="leftMask(target)"></div>
      <div class="fixed right-0 z-[500] bg-slate-950/55" [ngStyle]="rightMask(target)"></div>

      <div class="pointer-events-none fixed z-[501] rounded-xl border-2 border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.22)] transition-all duration-150"
        [ngStyle]="highlight(target)" aria-hidden="true"></div>

      @if (tour.currentStep(); as step) {
        <section role="dialog" aria-modal="true" aria-labelledby="tour-step-title"
          class="fixed z-[502] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
          [ngStyle]="popover(target, step.preferredPosition)">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
                Paso {{ tour.currentIndex() + 1 }} de {{ tour.totalSteps() }}
              </p>
              <h2 id="tour-step-title" class="mt-1 text-base font-extrabold text-slate-900">{{ step.title }}</h2>
            </div>
            <button type="button" (click)="tour.close()" aria-label="Cerrar recorrido"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <i class="pi pi-times text-xs"></i>
            </button>
          </div>
          <p class="mt-2 text-sm leading-5 text-slate-600">{{ step.description }}</p>
          <div class="mt-4 flex items-center justify-between gap-2">
            <button type="button" (click)="tour.close()" class="text-xs font-bold text-slate-500 hover:text-slate-700">Salir</button>
            <div class="flex gap-2">
              @if (tour.currentIndex() > 0) {
                <button type="button" (click)="tour.previous()"
                  class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Atrás</button>
              }
              <button type="button" (click)="tour.next()"
                class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                {{ tour.currentIndex() === tour.totalSteps() - 1 ? 'Finalizar' : 'Siguiente' }}
              </button>
            </div>
          </div>
        </section>
      }
    }
  `
})
export class GuidedTourOverlayComponent implements OnInit, OnDestroy {
  readonly tour = inject(GuidedTourService);
  private readonly refresh = () => this.tour.refreshTarget();
  private readonly pad = 7;

  ngOnInit(): void {
    document.addEventListener('scroll', this.refresh, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.refresh, true);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.tour.refreshTarget();
  }

  topMask(r: TourTargetRect) {
    return { height: `${Math.max(0, r.top - this.pad)}px` };
  }

  bottomMask(r: TourTargetRect) {
    const top = Math.min(window.innerHeight, r.top + r.height + this.pad);
    return { top: `${top}px`, width: '100vw' };
  }

  leftMask(r: TourTargetRect) {
    return {
      top: `${Math.max(0, r.top - this.pad)}px`,
      width: `${Math.max(0, r.left - this.pad)}px`,
      height: `${Math.min(window.innerHeight, r.height + this.pad * 2)}px`
    };
  }

  rightMask(r: TourTargetRect) {
    const left = Math.min(window.innerWidth, r.left + r.width + this.pad);
    return {
      top: `${Math.max(0, r.top - this.pad)}px`,
      left: `${left}px`,
      height: `${Math.min(window.innerHeight, r.height + this.pad * 2)}px`
    };
  }

  highlight(r: TourTargetRect) {
    return {
      top: `${Math.max(0, r.top - this.pad)}px`,
      left: `${Math.max(0, r.left - this.pad)}px`,
      width: `${r.width + this.pad * 2}px`,
      height: `${r.height + this.pad * 2}px`
    };
  }

  popover(r: TourTargetRect, preferred?: 'top' | 'right' | 'bottom' | 'left') {
    const width = Math.min(352, window.innerWidth - 24);
    const estimatedHeight = 230;
    const gap = 18;
    if (window.innerWidth < 640) {
      return { left: '12px', bottom: '12px', width: `${width}px` };
    }

    const candidates = preferred ? [preferred, 'right', 'bottom', 'left', 'top'] : ['right', 'bottom', 'left', 'top'];
    for (const position of [...new Set(candidates)]) {
      if (position === 'right' && r.left + r.width + gap + width <= window.innerWidth) {
        return { left: `${r.left + r.width + gap}px`, top: `${this.clamp(r.top, 12, window.innerHeight - estimatedHeight - 12)}px`, width: `${width}px` };
      }
      if (position === 'left' && r.left - gap - width >= 0) {
        return { left: `${r.left - gap - width}px`, top: `${this.clamp(r.top, 12, window.innerHeight - estimatedHeight - 12)}px`, width: `${width}px` };
      }
      if (position === 'bottom' && r.top + r.height + gap + estimatedHeight <= window.innerHeight) {
        return { left: `${this.clamp(r.left, 12, window.innerWidth - width - 12)}px`, top: `${r.top + r.height + gap}px`, width: `${width}px` };
      }
      if (position === 'top' && r.top - gap - estimatedHeight >= 0) {
        return { left: `${this.clamp(r.left, 12, window.innerWidth - width - 12)}px`, top: `${r.top - gap - estimatedHeight}px`, width: `${width}px` };
      }
    }
    return { right: '12px', bottom: '12px', width: `${width}px` };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)));
  }
}
