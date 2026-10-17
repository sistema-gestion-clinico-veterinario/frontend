import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { AvisoPublico } from '../../../models/privacy/privacidad.model';
import { AvisoClinicaGate } from '../../../core/services/aviso-clinica-gate.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveInitialRoute } from '../../../core/routing/initial-route';
import { SessionService } from '../../../core/services/session.service';

@Component({
  selector: 'app-aviso-clinica',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './aviso-clinica.component.html'
})
export class AvisoClinicaComponent implements OnInit {
  private readonly privacidad = inject(PrivacidadService);
  private readonly gate = inject(AvisoClinicaGate);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  readonly aviso = signal<AvisoPublico | null>(null);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.privacidad.avisoVigente().subscribe({
      next: ({ data }) => {
        if (!data) {
          this.continuar();
          return;
        }
        this.aviso.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'El servicio no respondió. Intenta nuevamente.');
      }
    });
  }

  cerrarSesion(): void {
    this.session.logout();
  }

  entendido(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.privacidad.leiElAviso().subscribe({
      next: () => this.continuar(),
      error: (err) => {
        this.enviando.set(false);
        this.error.set(err.error?.message || 'No se pudo registrar. Intenta nuevamente.');
      }
    });
  }

  private continuar(): void {
    this.gate.marcarVisto();
    this.router.navigateByUrl(resolveInitialRoute(this.authStore.menu() ?? [], this.authStore.activeRolePurpose()));
  }
}
