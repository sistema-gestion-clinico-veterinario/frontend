import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiagnosticoIaComponent } from './diagnostico-ia.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('DiagnosticoIaComponent', () => {
  let component: DiagnosticoIaComponent;
  let fixture: ComponentFixture<DiagnosticoIaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagnosticoIaComponent, HttpClientTestingModule],
    })
    .overrideComponent(DiagnosticoIaComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(DiagnosticoIaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
