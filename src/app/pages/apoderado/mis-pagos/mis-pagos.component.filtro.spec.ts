import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisPagosComponent } from './mis-pagos.component';

const pago = (id: number, estadoPago: string): any => ({ id, estadoPago });

describe('MisPagosComponent — filtro por estado', () => {
  let component: MisPagosComponent;
  let fixture: ComponentFixture<MisPagosComponent>;

  const pagos = [pago(1, 'PAGADO'), pago(2, 'PENDIENTE'), pago(3, 'PAGADO')];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisPagosComponent, HttpClientTestingModule]
    })
      .overrideComponent(MisPagosComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MisPagosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.pagos.set(pagos);
    component.filtroEstado.set('');
  });

  it('sin filtro devuelve todos los pagos, tal cual', () => {
    expect(component.pagosFiltrados()).toBe(pagos);
  });

  it('con un estado devuelve solo los de ese estado', () => {
    component.filtroEstado.set('PAGADO');

    expect(component.pagosFiltrados().map(p => p.id)).toEqual([1, 3]);
  });

  it('un estado sin pagos deja la lista vacía', () => {
    component.filtroEstado.set('ANULADO');

    expect(component.pagosFiltrados()).toEqual([]);
  });

  it('las lecturas repetidas devuelven la misma lista, sin volver a filtrar', () => {
    component.filtroEstado.set('PAGADO');

    expect(component.pagosFiltrados()).toBe(component.pagosFiltrados());
  });

  it('si llegan pagos nuevos, el resultado se actualiza', () => {
    component.filtroEstado.set('PENDIENTE');
    expect(component.pagosFiltrados().length).toBe(1);

    component.pagos.set([...pagos, pago(4, 'PENDIENTE')]);

    expect(component.pagosFiltrados().map(p => p.id)).toEqual([2, 4]);
  });
});
