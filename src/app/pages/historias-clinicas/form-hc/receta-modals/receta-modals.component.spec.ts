import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecetaModalsComponent } from './receta-modals.component';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';

describe('RecetaModalsComponent', () => {
  let component: RecetaModalsComponent;
  let fixture: ComponentFixture<RecetaModalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecetaModalsComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RecetaModalsComponent);
    component = fixture.componentInstance;
    const fb = TestBed.inject(FormBuilder);
    component.form = fb.group({
      medicamento: [''],
      principioActivo: [''],
      dosis: [''],
      frecuencia: [''],
      duracionDias: [null],
      viaAdministracion: [''],
      instrucciones: [''],
      fechaInicio: [''],
      fechaFin: [''],
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
