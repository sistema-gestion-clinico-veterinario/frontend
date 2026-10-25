import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { resolveInitialRoute } from '../../../core/routing/initial-route';
import { AuthStore } from '../../../store/auth.store';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  templateUrl: './forbidden.component.html'
})
export class ForbiddenComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly authStore = inject(AuthStore);

  readonly haySesion = (this.authStore.menu() ?? []).length > 0;

  volver(): void {
    if (typeof window !== 'undefined' && window.history.length > 2) {
      this.location.back();
      return;
    }
    this.irAlInicio();
  }

  irAlInicio(): void {
    const destino = this.haySesion
      ? resolveInitialRoute(this.authStore.menu() ?? [], this.authStore.activeRolePurpose())
      : '/login';
    this.router.navigateByUrl(destino);
  }
}
