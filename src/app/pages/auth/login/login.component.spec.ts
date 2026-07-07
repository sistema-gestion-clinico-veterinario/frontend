import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LoginComponent – greeting', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigateByUrl']) },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['login', 'refreshToken']) },
      ],
    })
      .overrideComponent(LoginComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    jasmine.clock().install();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('returns "Buenos días" before noon (hour < 12)', () => {
    jasmine.clock().mockDate(new Date(2025, 6, 5, 9, 0, 0));
    expect(component.greeting).toBe('Buenos días');
  });

  it('returns "Buenas tardes" between noon and 19:00 (12 ≤ hour < 19)', () => {
    jasmine.clock().mockDate(new Date(2025, 6, 5, 15, 30, 0));
    expect(component.greeting).toBe('Buenas tardes');
  });

  it('returns "Buenas noches" at 19:00 or later (hour ≥ 19)', () => {
    jasmine.clock().mockDate(new Date(2025, 6, 5, 21, 0, 0));
    expect(component.greeting).toBe('Buenas noches');
  });
});
