import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MiHistorialComponent } from './mi-historial.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('MiHistorialComponent', () => {
  let component: MiHistorialComponent;
  let fixture: ComponentFixture<MiHistorialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiHistorialComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}), queryParamMap: of({ get: () => null }) } },
      ],
    })
    .overrideComponent(MiHistorialComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(MiHistorialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
