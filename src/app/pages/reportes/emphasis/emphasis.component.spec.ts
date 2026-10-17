import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportesEmphasisComponent } from './emphasis.component';
import { ItemCount } from '../../../models/response/reportes-clinicos-response';

describe('ReportesEmphasisComponent', () => {
  let fixture: ComponentFixture<ReportesEmphasisComponent>;
  let component: ReportesEmphasisComponent;

  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent?.replace(/\s+/g, ' ') ?? '';

  function mostrar(items: ItemCount[] | null, color?: string): void {
    fixture.componentRef.setInput('items', items);
    if (color) fixture.componentRef.setInput('color', color);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReportesEmphasisComponent] });
    fixture = TestBed.createComponent(ReportesEmphasisComponent);
    component = fixture.componentInstance;
  });

  it('destaca el primer elemento y lista el resto', () => {
    mostrar([
      { label: 'Vacuna antirrábica', count: 12 },
      { label: 'Desparasitación', count: 5 },
      { label: 'Control general', count: 2 }
    ]);

    expect(component.primero()?.label).toBe('Vacuna antirrábica');
    expect(component.resto().length).toBe(2);
    expect(html().querySelector('span.text-3xl')?.textContent?.trim()).toBe('12');
    expect(html().querySelectorAll('li').length).toBe(2);
    const primera = html().querySelectorAll('li')[0];
    expect(primera.textContent).toContain('Desparasitación');
    expect(primera.textContent).toContain('5');
  });

  it('con un solo elemento no muestra lista de los demás', () => {
    mostrar([{ label: 'Única', count: 1 }]);

    expect(component.resto()).toEqual([]);
    expect(html().querySelectorAll('li').length).toBe(0);
  });

  it('sin datos avisa que no hay resultados para los filtros', () => {
    mostrar([]);
    expect(texto()).toContain('Sin datos para los filtros seleccionados');

    mostrar(null);
    expect(component.primero()).toBeNull();
    expect(texto()).toContain('Sin datos para los filtros seleccionados');
  });

  it('pinta el destacado con el color indicado', () => {
    mostrar([{ label: 'A', count: 3 }], '#0ea5e9');

    const destacado = html().querySelector('div.rounded-xl') as HTMLElement;
    expect(destacado.style.background).toContain('rgb(14, 165, 233)');
  });
});
