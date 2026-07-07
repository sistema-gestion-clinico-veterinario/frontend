import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisPagosComponent } from './mis-pagos.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MisPagosComponent', () => {
  let component: MisPagosComponent;
  let fixture: ComponentFixture<MisPagosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisPagosComponent, HttpClientTestingModule],
    })
    .overrideComponent(MisPagosComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(MisPagosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
