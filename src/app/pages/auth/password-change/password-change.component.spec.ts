import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasswordChangeComponent } from './password-change.component';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from 'primeng/api';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthStore } from '../../../store/auth.store';

describe('PasswordChangeComponent', () => {
  let component: PasswordChangeComponent;
  let fixture: ComponentFixture<PasswordChangeComponent>;
  let router: jasmine.SpyObj<Router>;
  let store: InstanceType<typeof AuthStore>;

  const cleanAuth = {
    token: null as null, refreshToken: null as null,
    roles: [] as string[], menu: [] as any[],
    passwordChanged: false, needsCompanySelection: false,
  };

  beforeEach(async () => {
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PasswordChangeComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['changePassword']) },
        { provide: MessageService, useValue: jasmine.createSpyObj('MessageService', ['add']) },
      ],
    })
      .overrideComponent(PasswordChangeComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(PasswordChangeComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(AuthStore);
    store.logout();
    fixture.detectChanges();
  });

  describe('passwordStrength', () => {
    it('returns 0 for an empty password', () => {
      component.form.get('newPassword')?.setValue('');
      expect(component.passwordStrength).toBe(0);
    });

    it('returns 1 for a 6-char lowercase-only password', () => {
      component.form.get('newPassword')?.setValue('abcdef');
      expect(component.passwordStrength).toBe(1);
    });

    it('returns 2 when length ≥ 6 and contains a digit', () => {
      component.form.get('newPassword')?.setValue('abcde1');
      expect(component.passwordStrength).toBe(2);
    });

    it('returns 3 when length ≥ 10 and contains an uppercase letter', () => {
      component.form.get('newPassword')?.setValue('abcdefghiJ');
      expect(component.passwordStrength).toBe(3);
    });

    it('returns 4 when all criteria are met including a special character', () => {
      component.form.get('newPassword')?.setValue('Abcdefghi1!');
      expect(component.passwordStrength).toBe(4);
    });
  });

  describe('strengthClass', () => {
    it('returns bg-rose-400 for active bar at index 0 when score is 1', () => {
      component.form.get('newPassword')?.setValue('abcdef');
      expect(component.strengthClass(0)).toBe('bg-rose-400');
    });

    it('returns bg-slate-100 for an inactive bar when index ≥ score', () => {
      component.form.get('newPassword')?.setValue('abcdef');
      expect(component.strengthClass(1)).toBe('bg-slate-100');
    });
  });

  describe('strengthLabel', () => {
    it('returns "Muy débil" when score is 0', () => {
      component.form.get('newPassword')?.setValue('');
      expect(component.strengthLabel()).toBe('Muy débil');
    });
  });

  describe('passwordMatchValidator (form-level)', () => {
    it('sets { mismatch: true } on form group when passwords differ', () => {
      component.form.get('newPassword')?.setValue('password1');
      component.form.get('confirmPassword')?.setValue('different1');
      expect(component.form.errors).toEqual({ mismatch: true });
    });
  });

  describe('cancel routing', () => {
    it('navigates to the platform dashboard for PLATFORM_ADMIN', () => {
      store.setAuth({ ...cleanAuth, activeRolePurpose: 'PLATFORM_ADMIN' });
      component.cancel();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  });
});
