import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';
import { AuthStore } from '../../store/auth.store';
import { PrivacidadService } from './privacidad.service';

@Injectable({ providedIn: 'root' })
export class AvisoClinicaGate {
  private readonly privacidad = inject(PrivacidadService);
  private readonly authStore = inject(AuthStore);
  private resuelta: string | null = null;
  private enCurso: Observable<boolean> | null = null;

  debeMostrarse(): Observable<boolean> {
    if (!this.authStore.companyId()) return of(false);
    const clave = this.clave();
    if (this.resuelta === clave) return of(false);
    // Una navegación evalúa la guarda en varias rutas anidadas a la vez: todas comparten una sola consulta.
    if (this.enCurso) return this.enCurso;
    this.enCurso = this.privacidad.miEstado().pipe(
      map(({ data }) => {
        const pendiente = data.avisoPublicado && !data.vistaPorLaPersona;
        if (!pendiente) this.resuelta = clave;
        return pendiente;
      }),
      // Ante una caída no se permite continuar a ciegas: la pantalla del aviso
      // mostrará opciones para reintentar o cerrar la sesión.
      catchError(() => of(true)),
      finalize(() => { this.enCurso = null; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.enCurso;
  }

  marcarVisto(): void {
    this.resuelta = this.clave();
  }

  private clave(): string {
    return [this.authStore.companyId(), this.authStore.activeRoleId(), this.authStore.nombreCompleto()].join('|');
  }
}
