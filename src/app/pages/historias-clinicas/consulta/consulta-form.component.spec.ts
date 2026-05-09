import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsultaFormComponent } from './consulta-form.component';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ConsultaFormComponent', () => {
  let component: ConsultaFormComponent;
  let fixture: ComponentFixture<ConsultaFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultaFormComponent, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } }, params: of({ id: '1' }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsultaFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
