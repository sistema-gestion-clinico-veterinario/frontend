import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportesMeterComponent } from './meter.component';
import { ItemCount } from '../../../models/response/reportes-clinicos-response';

describe('ReportesMeterComponent', () => {
  let fixture: ComponentFixture<ReportesMeterComponent>;
  let component: ReportesMeterComponent;

  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';
  const datos = (alDia: number, atrasado: number): ItemCount[] => [
    { label: 'Al día', count: alDia },
    { label: 'Atrasado', count: atrasado }
  ];

  function mostrar(items: ItemCount[] | null, color?: string): void {
    fixture.componentRef.setInput('items', items);
    if (color) fixture.componentRef.setInput('color', color);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReportesMeterComponent] });
    fixture = TestBed.createComponent(ReportesMeterComponent);
    component = fixture.componentInstance;
  });

  it('calcula el porcentaje de mascotas al día', () => {
    mostrar(datos(3, 1));

    expect(component.alDia()).toBe(3);
    expect(component.atrasado()).toBe(1);
    expect(component.porcentaje()).toBe(75);
    expect(texto()).toContain('75%');
    expect(texto()).toContain('3 al día');
    expect(texto()).toContain('1 atrasado');
  });

  it('sin datos muestra 0% en lugar de fallar al dividir', () => {
    mostrar(datos(0, 0));
    expect(component.porcentaje()).toBe(0);
    expect(texto()).toContain('0%');

    mostrar(null);
    expect(component.alDia()).toBe(0);
    expect(component.atrasado()).toBe(0);
  });

  it('ignora las categorías que no corresponden', () => {
    mostrar([{ label: 'Otro', count: 9 }, { label: 'Al día', count: 2 }]);
    expect(component.alDia()).toBe(2);
    expect(component.atrasado()).toBe(0);
    expect(component.porcentaje()).toBe(100);
  });

  it('el arco se completa en proporción al porcentaje', () => {
    mostrar(datos(1, 1));
    const arco = html().querySelectorAll('circle')[1];

    const longitud = component.circumference;
    expect(Number(arco.getAttribute('stroke-dasharray'))).toBeCloseTo(longitud, 5);
    expect(Number(arco.getAttribute('stroke-dashoffset'))).toBeCloseTo(longitud / 2, 5);
  });

  it('usa el color indicado para el arco', () => {
    mostrar(datos(1, 0), '#123456');
    expect(html().querySelectorAll('circle')[1].getAttribute('stroke')).toBe('#123456');
  });
});
