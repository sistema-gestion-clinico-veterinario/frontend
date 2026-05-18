import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchivoModalsComponent } from './archivo-modals.component';

describe('ArchivoModalsComponent', () => {
  let component: ArchivoModalsComponent;
  let fixture: ComponentFixture<ArchivoModalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivoModalsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ArchivoModalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
