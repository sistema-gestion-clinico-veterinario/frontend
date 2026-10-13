import { ContrastMode } from '../../types/accessibility/contrast-mode.type';
import { CursorSize } from '../../types/accessibility/cursor-size.type';
import { TextAlignMode } from '../../types/accessibility/text-align-mode.type';

export interface AccessibilitySettings {
  contrast: ContrastMode;
  grayscale: boolean;
  saturation: number;
  brightness: number;
  textSize: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: TextAlignMode;
  highlightLinks: boolean;
  highlightHeadings: boolean;
  readableFont: boolean;
  stopAnimations: boolean;
  hideImages: boolean;
  cursorSize: CursorSize;
  readingGuide: boolean;
  readingMask: boolean;
}
