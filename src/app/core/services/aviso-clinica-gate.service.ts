import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { PrivacidadService } from './privacidad.service';

@Injectable({ providedIn: 'root' })
export class AvisoClinicaGate {
  private readonly privacidad = inject(PrivacidadService);
  private readonly authStore = inject(AuthStore);
  private resuelta: string | null = null;

  debeMostrarse(): Observable<boolean> {
    if (!this.authStore.companyId()) return of(false);
    const clave = this.clave();
    if (this.resuelta === clave) return of(false);
    return this.privacidad.miEstado().pipe(
      map(({ data }) => {
        const pendiente = data.avisoPublicado && !data.vistaPorLaPersona;
        if (!pendiente) this.resuelta = clave;
        return pendiente;
      }),
      catchError(() => of(false))
    );
  }

  marcarVisto(): void {
    this.resuelta = this.clave();
  }

  private clave(): string {
    return [this.authStore.companyId(), this.authStore.activeRoleId(), this.authStore.nombreCompleto()].join('|');
  }
}
