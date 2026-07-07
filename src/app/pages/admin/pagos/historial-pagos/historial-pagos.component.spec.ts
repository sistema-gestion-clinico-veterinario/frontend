import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistorialPagosComponent } from './historial-pagos.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('HistorialPagosComponent', () => {
  let component: HistorialPagosComponent;
  let fixture: ComponentFixture<HistorialPagosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialPagosComponent, HttpClientTestingModule],
    })
    .overrideComponent(HistorialPagosComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(HistorialPagosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
