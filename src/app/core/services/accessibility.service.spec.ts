import { TestBed } from '@angular/core/testing';
import { AccessibilityService } from './accessibility.service';

describe('AccessibilityService', () => {
  let service: AccessibilityService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccessibilityService);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('inicia con los valores por defecto cuando no hay nada en localStorage', () => {
    const settings = service.settings();
    expect(settings.contrast).toBe('normal');
    expect(settings.textSize).toBe(100);
    expect(service.hasActiveAdjustments()).toBeFalse();
  });

  it('stepContrast avanza normal -> alto -> invertido -> normal (da la vuelta)', () => {
    expect(service.contrastLevel()).toBe(0);
    service.stepContrast();
    expect(service.settings().contrast).toBe('high');
    expect(service.contrastLevel()).toBe(1);
    service.stepContrast();
    expect(service.settings().contrast).toBe('inverted');
    expect(service.contrastLevel()).toBe(2);
    service.stepContrast();
    expect(service.settings().contrast).toBe('normal');
    expect(service.contrastLevel()).toBe(0);
  });

  it('stepCursorSize avanza normal -> large -> xlarge -> normal (da la vuelta)', () => {
    service.stepCursorSize();
    expect(service.settings().cursorSize).toBe('large');
    service.stepCursorSize();
    expect(service.settings().cursorSize).toBe('xlarge');
    service.stepCursorSize();
    expect(service.settings().cursorSize).toBe('normal');
  });

  it('stepTextAlign recorre las 5 opciones y vuelve a la original', () => {
    const seen: string[] = [service.settings().textAlign];
    for (let i = 0; i < 5; i++) {
      service.stepTextAlign();
      seen.push(service.settings().textAlign);
    }
    expect(seen).toEqual(['default', 'left', 'center', 'right', 'justify', 'default']);
  });

  it('stepTextSize avanza de 20 en 20 hasta 200% y luego vuelve a 100%', () => {
    for (let i = 0; i < 5; i++) service.stepTextSize();
    expect(service.settings().textSize).toBe(200);
    expect(service.textSizeLevel()).toBe(5);
    service.stepTextSize();
    expect(service.settings().textSize).toBe(100);
    expect(service.textSizeLevel()).toBe(0);
  });

  it('stepLetterSpacing y stepLineHeight dan la vuelta tras el nivel maximo (3)', () => {
    for (let i = 0; i < 3; i++) service.stepLetterSpacing();
    expect(service.settings().letterSpacing).toBe(3);
    service.stepLetterSpacing();
    expect(service.settings().letterSpacing).toBe(0);

    for (let i = 0; i < 3; i++) service.stepLineHeight();
    expect(service.settings().lineHeight).toBe(3);
    service.stepLineHeight();
    expect(service.settings().lineHeight).toBe(0);
  });

  it('stepSaturation y stepBrightness recorren sus niveles predefinidos', () => {
    expect(service.saturationLevel()).toBe(0);
    service.stepSaturation();
    expect(service.saturationLevel()).toBe(1);
    expect(service.brightnessLevel()).toBe(0);
    service.stepBrightness();
    expect(service.brightnessLevel()).toBe(1);
  });

  it('toggle invierte un ajuste booleano especifico', () => {
    expect(service.settings().stopAnimations).toBeFalse();
    service.toggle('stopAnimations');
    expect(service.settings().stopAnimations).toBeTrue();
    service.toggle('stopAnimations');
    expect(service.settings().stopAnimations).toBeFalse();
  });

  it('aplica las clases correspondientes sobre <html> al activar un ajuste', () => {
    service.toggle('stopAnimations');
    expect(document.documentElement.classList.contains('a11y-stop-animations')).toBeTrue();

    service.stepContrast();
    expect(document.documentElement.classList.contains('a11y-contrast-high')).toBeTrue();
  });

  it('resetAll vuelve todos los ajustes a los valores por defecto', () => {
    service.toggle('stopAnimations');
    service.stepContrast();
    service.stepTextSize();
    expect(service.hasActiveAdjustments()).toBeTrue();

    service.resetAll();

    expect(service.hasActiveAdjustments()).toBeFalse();
    expect(service.settings().contrast).toBe('normal');
    expect(service.settings().textSize).toBe(100);
    expect(document.documentElement.classList.contains('a11y-stop-animations')).toBeFalse();
  });

  it('persiste los cambios en localStorage y los recupera en una nueva instancia', () => {
    service.toggle('hideImages');
    service.stepSaturation();

    const stored = JSON.parse(localStorage.getItem('accessibility_preferences') || '{}');
    expect(stored.hideImages).toBeTrue();
    expect(stored.saturation).toBe(50);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(AccessibilityService);
    expect(freshService.settings().hideImages).toBeTrue();
    expect(freshService.settings().saturation).toBe(50);
  });
});
