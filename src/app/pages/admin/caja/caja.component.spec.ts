import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajaComponent } from './caja.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('CajaComponent', () => {
  let component: CajaComponent;
  let fixture: ComponentFixture<CajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajaComponent, HttpClientTestingModule],
    })
    .overrideComponent(CajaComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(CajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
