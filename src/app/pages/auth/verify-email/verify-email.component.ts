import { Component, OnInit, inject, signal } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { strongPasswordValidators } from '../../../core/validators/password-policy.validator';

const DEFAULT_BRAND_COLOR = '#006BA8';
const DEFAULT_LOGO_URL = 'https://toqqwxveqxhlottwetev.supabase.co/storage/v1/object/public/vargas_vet/Fondo%20de%20Pantalla%20Computador%20Simple%20Beige%20(7).png';
const DEFAULT_COMPANY_NAME = 'SoftVet';

const GOOGLE_ACTIVATION_ERROR_MESSAGES: Record<string, string> = {
  google_cancelado: 'La activación con Google fue cancelada.',
  google_email_no_verificado: 'La cuenta de Google no tiene el correo verificado.',
  google_correo_no_coincide: 'La cuenta de Google seleccionada no corresponde con el correo de la invitación. Utilice la cuenta de Google correcta, o cree su contraseña a continuación.',
  google_fallo: 'No fue posible activar la cuenta con Google. Intente nuevamente, o cree su contraseña a continuación.',
};

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly companyService = inject(CompanyService);
  private readonly slugContext = inject(CompanySlugContext);
  private readonly fb = inject(FormBuilder);

  /** La empresa la resuelve la URL (slug), igual que login/forgot-password - el enlace
   * de verificación ya lo incluye (ver UsuarioServiceImpl.sendVerificationEmail). */
  slug: string | null = this.slugContext.slug();
  companyName = DEFAULT_COMPANY_NAME;
  logoUrl: string | null = null;
  colorPrimario = DEFAULT_BRAND_COLOR;
  /** Si el slug viene en la URL (siempre debería, el enlace del correo lo incluye) pero
   * no pudimos cargar la marca, lo mostramos - antes fallaba en silencio y se veia el
   * nombre generico "SystemVet" como si nada, sin forma de distinguir un bug real de
   * que de verdad no hay slug. */
  brandNotFound = false;

  token = this.readAndClearToken();
  estado = signal<'form' | 'enviando' | 'exito' | 'error' | 'reenviando' | 'reenviado'>('form');
  errorMsg = signal('');
  googleError = signal(this.readGoogleError());

  ngOnInit() {
    if (this.slug) {
      this.companyService.getBrandingBySlug(this.slug).subscribe({
        next: ({ data }) => {
          this.companyName = data?.name || DEFAULT_COMPANY_NAME;
          this.logoUrl = data?.logoUrl || DEFAULT_LOGO_URL;
          this.colorPrimario = data?.colorPrimario || DEFAULT_BRAND_COLOR;
        },
        error: () => {
          this.brandNotFound = true;
          this.logoUrl = DEFAULT_LOGO_URL;
        }
      });
    } else {
      this.logoUrl = DEFAULT_LOGO_URL;
    }
  }

  passwordForm = this.fb.group({
    password: ['', strongPasswordValidators()],
    confirmPassword: ['', strongPasswordValidators()]
  }, { validators: this.passwordsMatch });

  resendForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), noLeadingTrailingSpaceValidator(), Validators.maxLength(255)]]
  });

  passwordsMatch(group: any) {
    const p = group.get('password')?.value;
    const c = group.get('confirmPassword')?.value;
    return p === c ? null : { mismatch: true };
  }

  submitPassword() {
    const rawPwd = this.passwordForm.getRawValue().password ?? '';
    if (rawPwd !== rawPwd.trim()) {
      this.passwordForm.markAllAsTouched();
      this.errorMsg.set('La contraseña no debe iniciar ni terminar con espacios.');
      return;
    }
    if (this.passwordForm.invalid || !this.token) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.estado.set('enviando');
    this.errorMsg.set('');
    this.authService.setupAccount(this.token, this.passwordForm.value.password!).subscribe({
      next: () => this.estado.set('exito'),
      error: (err) => {
        // 404 = el token en si no existe o expiro (enlace muerto, ahi si aplica
        // "reenviar enlace"). Cualquier otro codigo es un problema con lo que la
        // persona envio (politica de contraseña, cuenta ya activada) - se queda en el
        // formulario para corregirlo, en vez de hacerla pensar que su invitación se rompió.
        if (err.status === 404) {
          this.estado.set('error');
          this.errorMsg.set(err.error?.message || 'El enlace expiró o ya fue utilizado.');
        } else {
          this.estado.set('form');
          this.errorMsg.set(err.error?.message || 'No se pudo activar la cuenta. Intenta nuevamente.');
        }
      }
    });
  }

  reenviar() {
    const rawEmail = this.resendForm.getRawValue().email ?? '';
    if (rawEmail !== rawEmail.trim()) {
      this.errorMsg.set('El correo no debe contener espacios.');
      return;
    }
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }
    this.estado.set('reenviando');
    this.authService.resendVerification(this.resendForm.value.email!).subscribe({
      next: () => this.estado.set('reenviado'),
      error: (err) => this.errorMsg.set(err.error?.message || 'Error al reenviar el correo')
    });
  }

  irAlLogin() {
    // El SlugUrlSerializer ya sabe el slug de esta pagina (si lo hay) y lo
    // vuelve a anteponer solo en la barra de direcciones - no hace falta
    // construirlo a mano aqui.
    this.router.navigate(['/login']);
  }

  /** El token viaja como "state" (prefijo "activate:") para que /auth/google/callback
   * sepa que este es un alta por invitación (no un login) y a qué cuenta corresponde -
   * el backend exige que el correo que Google confirme sea EXACTAMENTE el de esa
   * invitación antes de activar la cuenta. */
  continueWithGoogle(): void {
    if (!this.token) return;
    const params = new URLSearchParams({
      client_id: environment.googleClientId,
      redirect_uri: environment.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state: `activate:${this.token}`,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private readAndClearToken(): string {
    const fragmentParams = new URLSearchParams(this.route.snapshot.fragment ?? '');
    const token = fragmentParams.get('token') ?? this.route.snapshot.paramMap.get('token') ?? '';
    if (fragmentParams.has('token')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    return token;
  }

  private readGoogleError(): string {
    const code = this.route.snapshot.queryParamMap?.get('authError');
    return code ? (GOOGLE_ACTIVATION_ERROR_MESSAGES[code] ?? 'No se pudo activar la cuenta con Google. Intenta nuevamente.') : '';
  }
}
