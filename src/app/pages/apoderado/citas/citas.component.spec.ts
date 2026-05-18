import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CitasComponent } from './citas.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

describe('CitasComponent', () => {
  let component: CitasComponent;
  let fixture: ComponentFixture<CitasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CitasComponent,
        HttpClientTestingModule,
        ReactiveFormsModule,
        FormsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CitasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
