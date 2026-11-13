import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccessibilityWidgetComponent } from './accessibility-widget.component';

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
