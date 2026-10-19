import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComplementarioComponent } from './complementario.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { ReactiveFormsModule } from '@angular/forms';

describe('ComplementarioComponent', () => {
  let component: ComplementarioComponent;
  let fixture: ComponentFixture<ComplementarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplementarioComponent, HttpClientTestingModule, ReactiveFormsModule],
      providers: [MessageService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComplementarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reemplaza el skeleton por el contenido sin renderizarlos simultáneamente', () => {
    component.cargando.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="complementario-skeleton"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="complementario-content"]')).toBeNull();

    component.cargando.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="complementario-skeleton"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="complementario-content"]')).not.toBeNull();
  });

  it('desactiva emergencias al seleccionar un cargo no veterinario', () => {
    component.tiposEmpleadoCatalogo.set([
      { id: 1, nombre: 'Veterinario', estado: true, ejerceComoVeterinario: true },
      { id: 2, nombre: 'Groomer', estado: true, ejerceComoVeterinario: false }
    ]);
    component.servicioForm.patchValue({ tipoEmpleadoId: 1, permiteEmergencia: true });

    component.servicioForm.get('tipoEmpleadoId')?.setValue(2);

    expect(component.servicioForm.get('permiteEmergencia')?.value).toBeFalse();
  });
});
