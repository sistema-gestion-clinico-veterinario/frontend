import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoriaClinicaMascotaComponent } from './historia-clinica-mascota.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('HistoriaClinicaMascotaComponent', () => {
  let component: HistoriaClinicaMascotaComponent;
  let fixture: ComponentFixture<HistoriaClinicaMascotaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriaClinicaMascotaComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}), queryParamMap: of({ get: () => null }) } },
      ],
    })
    .overrideComponent(HistoriaClinicaMascotaComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(HistoriaClinicaMascotaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
