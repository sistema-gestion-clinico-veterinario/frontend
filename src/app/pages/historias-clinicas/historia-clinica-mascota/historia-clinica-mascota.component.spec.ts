import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoriaClinicaMascotaComponent } from './historia-clinica-mascota.component';

describe('HistoriaClinicaMascotaComponent', () => {
  let component: HistoriaClinicaMascotaComponent;
  let fixture: ComponentFixture<HistoriaClinicaMascotaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriaClinicaMascotaComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HistoriaClinicaMascotaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
