import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApoderadoPortalComponent } from './apoderado-portal.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

describe('ApoderadoPortalComponent', () => {
  let component: ApoderadoPortalComponent;
  let fixture: ComponentFixture<ApoderadoPortalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ApoderadoPortalComponent,
        HttpClientTestingModule,
        ReactiveFormsModule,
        FormsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ApoderadoPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
