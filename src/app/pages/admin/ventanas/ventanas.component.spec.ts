import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VentanasComponent } from './ventanas.component';

describe('VentanasComponent', () => {
  let component: VentanasComponent;
  let fixture: ComponentFixture<VentanasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentanasComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(VentanasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
