import { Injectable, computed, signal } from '@angular/core';

export type ContrastMode = 'normal' | 'high' | 'inverted';
export type CursorSize = 'normal' | 'large' | 'xlarge';
export type TextAlignMode = 'default' | 'left' | 'center' | 'right' | 'justify';

export interface AccessibilitySettings {
  contrast: ContrastMode;
  grayscale: boolean;
  saturation: number; // uno de SATURATION_LEVELS
  brightness: number; // uno de BRIGHTNESS_LEVELS
  textSize: number; // 100 - 200 (%), pasos de 20
  letterSpacing: number; // 0 - 3 pasos
  lineHeight: number; // 0 - 3 pasos
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

const STORAGE_KEY = 'accessibility_preferences';

const CONTRAST_ORDER: ContrastMode[] = ['normal', 'high', 'inverted'];
const CURSOR_ORDER: CursorSize[] = ['normal', 'large', 'xlarge'];
const TEXT_ALIGN_ORDER: TextAlignMode[] = ['default', 'left', 'center', 'right', 'justify'];
const SATURATION_LEVELS = [100, 50, 75, 150, 200];
const BRIGHTNESS_LEVELS = [100, 70, 85, 115, 130];
const TEXT_SIZE_STEP = 20;
const TEXT_SIZE_MIN = 100;
const TEXT_SIZE_MAX_LEVEL = 5;
const LETTER_SPACING_MAX_LEVEL = 3;
const LINE_HEIGHT_MAX_LEVEL = 3;

const DEFAULT_SETTINGS: AccessibilitySettings = {
  contrast: 'normal',
  grayscale: false,
  saturation: SATURATION_LEVELS[0],
  brightness: BRIGHTNESS_LEVELS[0],
  textSize: TEXT_SIZE_MIN,
  letterSpacing: 0,
  lineHeight: 0,
  textAlign: 'default',
  highlightLinks: false,
  highlightHeadings: false,
  readableFont: false,
  stopAnimations: false,
  hideImages: false,
  cursorSize: 'normal',
  readingGuide: false,
  readingMask: false,
};

function loadInitialSettings(): AccessibilitySettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Avanza al siguiente valor del arreglo y da la vuelta al llegar al final. */
function nextInOrder<T>(order: readonly T[], current: T): T {
  return order[(order.indexOf(current) + 1) % order.length];
}

@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  private readonly settingsSignal = signal<AccessibilitySettings>(loadInitialSettings());
  readonly settings = this.settingsSignal.asReadonly();

  readonly hasActiveAdjustments = computed(() => {
    const current = this.settingsSignal();
    return JSON.stringify(current) !== JSON.stringify(DEFAULT_SETTINGS);
  });

  // Niveles (0-based) usados por las cards para pintar la barra de progreso.
  readonly contrastLevel = computed(() => CONTRAST_ORDER.indexOf(this.settingsSignal().contrast));
  readonly cursorLevel = computed(() => CURSOR_ORDER.indexOf(this.settingsSignal().cursorSize));
  readonly textAlignLevel = computed(() => TEXT_ALIGN_ORDER.indexOf(this.settingsSignal().textAlign));
  readonly textSizeLevel = computed(() =>
    Math.round((this.settingsSignal().textSize - TEXT_SIZE_MIN) / TEXT_SIZE_STEP));
  readonly saturationLevel = computed(() => SATURATION_LEVELS.indexOf(this.settingsSignal().saturation));
  readonly brightnessLevel = computed(() => BRIGHTNESS_LEVELS.indexOf(this.settingsSignal().brightness));

  readonly maxLevels = {
    contrast: CONTRAST_ORDER.length - 1,
    cursor: CURSOR_ORDER.length - 1,
    textAlign: TEXT_ALIGN_ORDER.length - 1,
    textSize: TEXT_SIZE_MAX_LEVEL,
    letterSpacing: LETTER_SPACING_MAX_LEVEL,
    lineHeight: LINE_HEIGHT_MAX_LEVEL,
    saturation: SATURATION_LEVELS.length - 1,
    brightness: BRIGHTNESS_LEVELS.length - 1,
  };

  constructor() {
    // Aplica lo que ya hubiera en localStorage desde el primer render,
    // sin esperar a la primera mutación.
    this.applyToDocument(this.settingsSignal());
  }

  toggle(key: keyof Pick<AccessibilitySettings,
    'grayscale' | 'highlightLinks' | 'highlightHeadings' | 'readableFont' |
    'stopAnimations' | 'hideImages' | 'readingGuide' | 'readingMask'>): void {
    this.commit(current => ({ ...current, [key]: !current[key] }));
  }

  /** Cada "step*" avanza un nivel y da la vuelta a 0 al pasar el máximo — un solo tap por card. */
  stepContrast(): void {
    this.commit(current => ({ ...current, contrast: nextInOrder(CONTRAST_ORDER, current.contrast) }));
  }

  stepCursorSize(): void {
    this.commit(current => ({ ...current, cursorSize: nextInOrder(CURSOR_ORDER, current.cursorSize) }));
  }

  stepTextAlign(): void {
    this.commit(current => ({ ...current, textAlign: nextInOrder(TEXT_ALIGN_ORDER, current.textAlign) }));
  }

  stepTextSize(): void {
    this.commit(current => {
      const nextLevel = (Math.round((current.textSize - TEXT_SIZE_MIN) / TEXT_SIZE_STEP) + 1) % (TEXT_SIZE_MAX_LEVEL + 1);
      return { ...current, textSize: TEXT_SIZE_MIN + nextLevel * TEXT_SIZE_STEP };
    });
  }

  stepLetterSpacing(): void {
    this.commit(current => ({ ...current, letterSpacing: (current.letterSpacing + 1) % (LETTER_SPACING_MAX_LEVEL + 1) }));
  }

  stepLineHeight(): void {
    this.commit(current => ({ ...current, lineHeight: (current.lineHeight + 1) % (LINE_HEIGHT_MAX_LEVEL + 1) }));
  }

  stepSaturation(): void {
    this.commit(current => ({ ...current, saturation: nextInOrder(SATURATION_LEVELS, current.saturation) }));
  }

  stepBrightness(): void {
    this.commit(current => ({ ...current, brightness: nextInOrder(BRIGHTNESS_LEVELS, current.brightness) }));
  }

  resetAll(): void {
    this.commit(() => ({ ...DEFAULT_SETTINGS }));
  }

  private commit(mutate: (current: AccessibilitySettings) => AccessibilitySettings): void {
    let next!: AccessibilitySettings;
    this.settingsSignal.update(current => {
      next = mutate(current);
      return next;
    });
    this.applyToDocument(next);
    this.persist(next);
  }

  private persist(settings: AccessibilitySettings): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Almacenamiento no disponible (modo privado, cuota llena, etc.); se ignora.
    }
  }

  private applyToDocument(settings: AccessibilitySettings): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    root.classList.toggle('a11y-contrast-high', settings.contrast === 'high');
    root.classList.toggle('a11y-contrast-inverted', settings.contrast === 'inverted');
    root.classList.toggle('a11y-grayscale', settings.grayscale);
    root.classList.toggle('a11y-highlight-links', settings.highlightLinks);
    root.classList.toggle('a11y-highlight-headings', settings.highlightHeadings);
    root.classList.toggle('a11y-readable-font', settings.readableFont);
    root.classList.toggle('a11y-stop-animations', settings.stopAnimations);
    root.classList.toggle('a11y-hide-images', settings.hideImages);
    root.classList.toggle('a11y-cursor-large', settings.cursorSize === 'large');
    root.classList.toggle('a11y-cursor-xlarge', settings.cursorSize === 'xlarge');
    root.classList.toggle('a11y-text-align-left', settings.textAlign === 'left');
    root.classList.toggle('a11y-text-align-center', settings.textAlign === 'center');
    root.classList.toggle('a11y-text-align-right', settings.textAlign === 'right');
    root.classList.toggle('a11y-text-align-justify', settings.textAlign === 'justify');
    root.classList.toggle('a11y-letter-spacing-active', settings.letterSpacing > 0);
    root.classList.toggle('a11y-line-height-active', settings.lineHeight > 0);

    root.style.setProperty('--a11y-saturate', `${settings.saturation}%`);
    root.style.setProperty('--a11y-brightness', `${settings.brightness}%`);
    root.style.setProperty('--a11y-text-scale', `${settings.textSize / 100}`);
    root.style.setProperty('--a11y-letter-spacing', `${settings.letterSpacing * 0.06}em`);
    root.style.setProperty('--a11y-line-height', `${1.4 + settings.lineHeight * 0.35}`);
  }
}
