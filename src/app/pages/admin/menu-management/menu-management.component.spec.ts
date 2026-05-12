import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuManagementComponent } from './menu-management.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';

describe('MenuManagementComponent', () => {
  let component: MenuManagementComponent;
  let fixture: ComponentFixture<MenuManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MenuManagementComponent,
        HttpClientTestingModule,
        ReactiveFormsModule
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
