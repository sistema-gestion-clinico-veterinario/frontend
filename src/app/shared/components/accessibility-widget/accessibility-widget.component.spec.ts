import { NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccessibilityService } from '../../../core/services/accessibility.service';
import { AccessibilityWidgetComponent } from './accessibility-widget.component';

describe('AccessibilityWidgetComponent — seguimiento del ratón', () => {
  let fixture: ComponentFixture<AccessibilityWidgetComponent>;
  let component: AccessibilityWidgetComponent;
  let a11y: AccessibilityService;
  let alta: jasmine.Spy;
  let baja: jasmine.Spy;

  const mover = (y: number) => document.dispatchEvent(new MouseEvent('mousemove', { clientY: y, bubbles: true }));
  const escuchasDeRaton = (espia: jasmine.Spy) => espia.calls.allArgs().filter(([tipo]) => tipo === 'mousemove').length;

  beforeEach(async () => {
    window.localStorage.clear();
    await TestBed.configureTestingModule({ imports: [AccessibilityWidgetComponent] })
      .overrideComponent(AccessibilityWidgetComponent, { set: { template: '' } })
      .compileComponents();

    alta = spyOn(document, 'addEventListener').and.callThrough();
    baja = spyOn(document, 'removeEventListener').and.callThrough();
    a11y = TestBed.inject(AccessibilityService);
    fixture = TestBed.createComponent(AccessibilityWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    window.localStorage.clear();
  });

  it('sin guía ni máscara de lectura no escucha el movimiento del ratón', () => {
    expect(escuchasDeRaton(alta)).toBe(0);
  });

  it('con la guía de lectura activa sigue al ratón', () => {
    a11y.toggle('readingGuide');
    fixture.detectChanges();

    mover(123);

    expect(component.guideY()).toBe(123);
    expect(component.maskY()).toBe(0);
  });

  it('con la máscara de lectura activa sigue al ratón', () => {
    a11y.toggle('readingMask');
    fixture.detectChanges();

    mover(77);

    expect(component.maskY()).toBe(77);
    expect(component.guideY()).toBe(0);
  });

  it('el seguimiento no se ejecuta dentro de la zona de Angular', () => {
    a11y.toggle('readingGuide');
    fixture.detectChanges();
    let dentroDeLaZona: boolean | null = null;
    const original = component.guideY.set.bind(component.guideY);
    spyOn(component.guideY, 'set').and.callFake((valor: number) => {
      dentroDeLaZona = NgZone.isInAngularZone();
      original(valor);
    });

    mover(10);

    expect(dentroDeLaZona).toBeFalse();
  });

  it('al apagar la guía deja de escuchar y de moverla', () => {
    a11y.toggle('readingGuide');
    fixture.detectChanges();
    mover(50);
    a11y.toggle('readingGuide');
    fixture.detectChanges();

    mover(200);

    expect(component.guideY()).toBe(50);
    expect(escuchasDeRaton(baja)).toBe(1);
  });

  it('al activar la guía y la máscara usa una sola escucha', () => {
    a11y.toggle('readingGuide');
    fixture.detectChanges();
    a11y.toggle('readingMask');
    fixture.detectChanges();

    mover(300);

    expect(component.guideY()).toBe(300);
    expect(component.maskY()).toBe(300);
    expect(escuchasDeRaton(alta) - escuchasDeRaton(baja)).toBe(1);
  });

  it('cambiar otro ajuste no vuelve a registrar la escucha', () => {
    a11y.toggle('readingGuide');
    fixture.detectChanges();
    const antes = escuchasDeRaton(alta);

    a11y.toggle('grayscale');
    fixture.detectChanges();

    expect(escuchasDeRaton(alta)).toBe(antes);
  });

  it('al destruir el componente retira la escucha', () => {
    a11y.toggle('readingGuide');
    fixture.detectChanges();

    fixture.destroy();
    mover(999);

    expect(component.guideY()).not.toBe(999);
    expect(escuchasDeRaton(alta) - escuchasDeRaton(baja)).toBe(0);
  });
});

describe('AccessibilityWidgetComponent — indicadores de nivel', () => {
  let component: AccessibilityWidgetComponent;
  let fixture: ComponentFixture<AccessibilityWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccessibilityWidgetComponent] })
      .overrideComponent(AccessibilityWidgetComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(AccessibilityWidgetComponent);
    component = fixture.componentInstance;
  });

  it('devuelve un punto por nivel, numerados desde cero', () => {
    expect(component.dotsArray(3)).toEqual([0, 1, 2]);
    expect(component.dotsArray(0)).toEqual([]);
  });

  it('el mismo número de niveles devuelve siempre la misma lista', () => {
    expect(component.dotsArray(4)).toBe(component.dotsArray(4));
  });

  it('cada cantidad de niveles tiene su propia lista', () => {
    expect(component.dotsArray(2)).not.toBe(component.dotsArray(3));
    expect(component.dotsArray(2).length).toBe(2);
  });
});
