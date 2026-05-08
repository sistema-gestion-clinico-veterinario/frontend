import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuFormComponent } from './menu-form.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('MenuFormComponent', () => {
  let component: MenuFormComponent;
  let fixture: ComponentFixture<MenuFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuFormComponent, ReactiveFormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
