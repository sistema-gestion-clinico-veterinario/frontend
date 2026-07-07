import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LaboratorioComponent } from './laboratorio.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LaboratorioComponent', () => {
  let component: LaboratorioComponent;
  let fixture: ComponentFixture<LaboratorioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LaboratorioComponent, HttpClientTestingModule],
    })
    .overrideComponent(LaboratorioComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(LaboratorioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
