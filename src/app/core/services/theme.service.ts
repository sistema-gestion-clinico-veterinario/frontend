import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'softvet_theme_preference';
const DEFAULT_THEME: ThemePreference = 'system';

function loadPreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly preferenceSignal = signal<ThemePreference>(loadPreference());
  private readonly systemDarkSignal = signal(false);
  private mediaQuery: MediaQueryList | null = null;

  readonly preference = this.preferenceSignal.asReadonly();
  readonly resolvedTheme = computed<ResolvedTheme>(() =>
    this.preferenceSignal() === 'system'
      ? (this.systemDarkSignal() ? 'dark' : 'light')
      : this.preferenceSignal() as ResolvedTheme
  );

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDarkSignal.set(this.mediaQuery.matches);

      const onSystemThemeChange = (event: MediaQueryListEvent) => this.systemDarkSignal.set(event.matches);
      this.mediaQuery.addEventListener?.('change', onSystemThemeChange);
      this.destroyRef.onDestroy(() => this.mediaQuery?.removeEventListener?.('change', onSystemThemeChange));
    }

    effect(() => this.applyTheme(this.resolvedTheme()));
  }

  setPreference(preference: ThemePreference): void {
    this.preferenceSignal.set(preference);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // La preferencia sigue activa durante la sesión aunque el navegador bloquee el almacenamiento.
    }
  }

  private applyTheme(theme: ResolvedTheme): void {
    const root = this.document.documentElement;
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme === 'light');
    root.dataset['theme'] = theme;
    root.style.colorScheme = theme;
  }
}
