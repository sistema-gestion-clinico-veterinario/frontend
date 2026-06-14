import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MascotaFormComponent } from './mascota-form.component';

describe('MascotaFormComponent', () => {
  let component: MascotaFormComponent;
  let fixture: ComponentFixture<MascotaFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MascotaFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MascotaFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
