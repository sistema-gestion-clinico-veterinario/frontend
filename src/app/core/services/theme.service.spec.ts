import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.removeAttribute('data-theme');

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jasmine.createSpy().and.returnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: jasmine.createSpy(),
        removeEventListener: jasmine.createSpy(),
        addListener: jasmine.createSpy(),
        removeListener: jasmine.createSpy(),
        dispatchEvent: jasmine.createSpy()
      } as MediaQueryList)
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    TestBed.tick();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('usa el tema claro como preferencia inicial', () => {
    expect(service.preference()).toBe('light');
    expect(service.resolvedTheme()).toBe('light');
    expect(document.documentElement.classList.contains('theme-light')).toBeTrue();
  });

  it('aplica y persiste el modo oscuro', () => {
    service.setPreference('dark');
    TestBed.tick();

    expect(service.resolvedTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBeTrue();
    expect(localStorage.getItem('softvet_theme_preference')).toBe('dark');
  });

  it('vuelve al modo claro sin conservar la clase oscura', () => {
    service.setPreference('dark');
    TestBed.tick();
    service.setPreference('light');
    TestBed.tick();

    expect(document.documentElement.classList.contains('theme-dark')).toBeFalse();
    expect(document.documentElement.classList.contains('theme-light')).toBeTrue();
  });
});
