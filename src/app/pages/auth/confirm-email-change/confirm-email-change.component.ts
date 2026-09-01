import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-confirm-email-change',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          [ngClass]="error() ? 'bg-red-50 text-red-600' : completed() ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-[#0066AA]'">
          <i class="pi" [ngClass]="loading() ? 'pi-spin pi-spinner' : error() ? 'pi-times' : 'pi-check'"></i>
        </div>
        <h1 class="text-xl font-bold text-slate-900">Confirmación de correo</h1>
        <p class="mt-3 text-sm leading-6 text-slate-600">{{ message() }}</p>
        <a *ngIf="!loading()" routerLink="/login"
          class="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#0066AA] px-5 text-sm font-semibold text-white">
          Ir al inicio de sesión
        </a>
      </section>
    </main>
  `
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
    if (!token || (type !== 'actual' && type !== 'nuevo')) {
      this.fail('El enlace de confirmación no es válido.');
      return;
    }

    this.authService.confirmEmailChange(type, token).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.completed.set(response.data === true);
        this.message.set(response.data
          ? 'El correo fue actualizado y todas las sesiones anteriores se cerraron.'
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
