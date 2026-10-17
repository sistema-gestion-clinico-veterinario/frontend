import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistorialPagosComponent } from './historial-pagos.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('HistorialPagosComponent', () => {
  let component: HistorialPagosComponent;
  let fixture: ComponentFixture<HistorialPagosComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialPagosComponent, HttpClientTestingModule],
    })
    .overrideComponent(HistorialPagosComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(HistorialPagosComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url.endsWith('/payments/history')).flush({
      success: true,
      message: 'ok',
      data: { content: [], totalElements: 0 }
    });
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('vuelve a la primera página y solicita los filtros al backend', () => {
    component.currentPage.set(3);
    component.onEstadoChange('PAID');

    const estadoRequest = httpMock.expectOne((request) =>
      request.url.endsWith('/payments/history') && request.params.get('estado') === 'PAID'
    );
    expect(estadoRequest.request.params.get('page')).toBe('0');
    estadoRequest.flush({ success: true, message: 'ok', data: { content: [], totalElements: 0 } });

    component.onMetodoChange('YAPE');
    const metodoRequest = httpMock.expectOne((request) =>
      request.url.endsWith('/payments/history')
      && request.params.get('estado') === 'PAID'
      && request.params.get('metodoPago') === 'YAPE'
    );
    metodoRequest.flush({ success: true, message: 'ok', data: { content: [], totalElements: 0 } });
  });
});
