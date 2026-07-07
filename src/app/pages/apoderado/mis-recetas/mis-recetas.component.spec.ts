import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisRecetasComponent } from './mis-recetas.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MisRecetasComponent', () => {
  let component: MisRecetasComponent;
  let fixture: ComponentFixture<MisRecetasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisRecetasComponent, HttpClientTestingModule],
    })
    .overrideComponent(MisRecetasComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(MisRecetasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
