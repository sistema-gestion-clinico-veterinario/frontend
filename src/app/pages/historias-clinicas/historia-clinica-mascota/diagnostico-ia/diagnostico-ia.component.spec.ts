import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiagnosticoIaComponent } from './diagnostico-ia.component';

describe('DiagnosticoIaComponent', () => {
  let component: DiagnosticoIaComponent;
  let fixture: ComponentFixture<DiagnosticoIaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagnosticoIaComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DiagnosticoIaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
