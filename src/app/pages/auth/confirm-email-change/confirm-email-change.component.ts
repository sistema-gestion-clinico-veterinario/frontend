import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-confirm-email-change',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './confirm-email-change.component.html'
})
export class ConfirmEmailChangeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  loading = signal(true);
  completed = signal(false);
  error = signal(false);
  message = signal('Validando el enlace de confirmación...');

  ngOnInit() {
    const fragmentParams = new URLSearchParams(this.route.snapshot.fragment ?? '');
    const token = fragmentParams.get('token') ?? this.route.snapshot.queryParamMap.get('token');
    const type = fragmentParams.get('type') ?? this.route.snapshot.queryParamMap.get('type');
    if (fragmentParams.has('token')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (!token || (type !== 'actual' && type !== 'nuevo' && type !== 'cancelar')) {
      this.fail('El enlace de confirmación no es válido.');
      return;
    }

    if (type === 'cancelar') {
      this.authService.cancelEmailChange(token).subscribe({
        next: () => {
          this.loading.set(false);
          this.completed.set(true);
          this.message.set('Cancelamos la solicitud de cambio de correo: tu correo de acceso no cambió. '
            + 'Si no fuiste tú, te recomendamos cambiar tu contraseña y avisar a la empresa.');
        },
        error: (err) => this.fail(err.error?.message || 'El enlace es inválido o la solicitud ya no está vigente.')
      });
      return;
    }
    this.authService.confirmEmailChange(type, token).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.completed.set(response.data === true);
        this.message.set(response.data
          ? 'El correo fue actualizado y todas las sesiones anteriores se cerraron. Desde ahora inicia sesión con tu correo nuevo.'
          : 'Esta dirección fue confirmada. La operación se completará cuando se confirme también el otro correo.');
      },
      error: (err) => this.fail(err.error?.message || 'El enlace expiró o ya fue utilizado.')
    });
  }

  private fail(message: string) {
    this.loading.set(false);
    this.error.set(true);
    this.message.set(message);
  }
}
