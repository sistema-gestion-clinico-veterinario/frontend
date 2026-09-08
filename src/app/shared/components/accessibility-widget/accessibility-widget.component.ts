import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { AccessibilityService } from '../../../core/services/accessibility.service';

@Component({
  selector: 'app-accessibility-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accessibility-widget.component.html',
  styleUrl: './accessibility-widget.component.scss'
})
export class AccessibilityWidgetComponent {
  readonly a11y = inject(AccessibilityService);
  readonly panelOpen = signal(false);
  readonly guideY = signal(0);
  readonly maskY = signal(0);

  togglePanel(): void {
    this.panelOpen.update(open => !open);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.a11y.settings().readingGuide) {
      this.guideY.set(event.clientY);
    }
    if (this.a11y.settings().readingMask) {
      this.maskY.set(event.clientY);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePanel();
  }

  dotsArray(count: number): number[] {
    return Array.from({ length: count });
  }

  // Cada card llama solo al método que le compete — sin efectos cruzados entre ajustes.
  readonly stepContrast = () => this.a11y.stepContrast();
  readonly stepCursorSize = () => this.a11y.stepCursorSize();
  readonly stepTextAlign = () => this.a11y.stepTextAlign();
  readonly stepTextSize = () => this.a11y.stepTextSize();
  readonly stepLetterSpacing = () => this.a11y.stepLetterSpacing();
  readonly stepLineHeight = () => this.a11y.stepLineHeight();
  readonly stepSaturation = () => this.a11y.stepSaturation();
  readonly stepBrightness = () => this.a11y.stepBrightness();

  readonly toggleGrayscale = () => this.a11y.toggle('grayscale');
  readonly toggleHighlightLinks = () => this.a11y.toggle('highlightLinks');
  readonly toggleHighlightHeadings = () => this.a11y.toggle('highlightHeadings');
  readonly toggleReadableFont = () => this.a11y.toggle('readableFont');
  readonly toggleStopAnimations = () => this.a11y.toggle('stopAnimations');
  readonly toggleHideImages = () => this.a11y.toggle('hideImages');
  readonly toggleReadingGuide = () => this.a11y.toggle('readingGuide');
  readonly toggleReadingMask = () => this.a11y.toggle('readingMask');
}
