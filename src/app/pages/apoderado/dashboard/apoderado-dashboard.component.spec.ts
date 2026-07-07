import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApoderadoDashboardComponent } from './apoderado-dashboard.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ApoderadoDashboardComponent', () => {
  let component: ApoderadoDashboardComponent;
  let fixture: ComponentFixture<ApoderadoDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApoderadoDashboardComponent, HttpClientTestingModule],
    })
    .overrideComponent(ApoderadoDashboardComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ApoderadoDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
