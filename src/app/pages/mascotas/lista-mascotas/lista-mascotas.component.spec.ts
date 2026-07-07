import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaMascotasComponent } from './lista-mascotas.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ListaMascotasComponent', () => {
  let component: ListaMascotasComponent;
  let fixture: ComponentFixture<ListaMascotasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaMascotasComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}), queryParamMap: of({ get: () => null }) } },
      ],
    })
    .overrideComponent(ListaMascotasComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ListaMascotasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
