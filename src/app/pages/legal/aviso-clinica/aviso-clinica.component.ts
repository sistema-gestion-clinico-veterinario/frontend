import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AvisoPublico, PrivacidadService } from '../../../core/services/privacidad.service';
import { AvisoClinicaGate } from '../../../core/services/aviso-clinica-gate.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveInitialRoute } from '../../../layouts/main-layout/navbar/navbar.component';

@Component({
  selector: 'app-aviso-clinica',
  standalone: true,
  imports: [DatePipe],
  template: `
    <main class="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      @if (cargando()) {
        <p class="text-center text-sm text-slate-500">Cargando…</p>
      } @else if (aviso(); as a) {
        <header class="mb-5">
          <h1 class="text-xl font-extrabold text-slate-900">Aviso de privacidad de {{ a.clinica }}</h1>
          <p class="mt-1 text-sm text-slate-500">Versión {{ a.version }} · vigente desde {{ a.vigenteDesde | date: 'dd/MM/yyyy' }}</p>
          <p class="mt-3 text-sm text-slate-600">Antes de continuar, esto es lo que la clínica hace con tus datos personales. Es solo informativo: no tienes que aceptar nada para atenderte.</p>
        </header>
        <article class="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 sm:p-8">{{ a.contenido }}</article>
        @if (error()) {
          <p class="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{{ error() }}</p>
        }
        <div class="mt-5 flex justify-end">
          <button type="button" (click)="entendido()" [disabled]="enviando()"
            class="rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {{ enviando() ? 'Guardando…' : 'Entendido, continuar' }}
          </button>
        </div>
      }
    </main>
  `
})
export class AvisoClinicaComponent implements OnInit {
  private readonly privacidad = inject(PrivacidadService);
  private readonly gate = inject(AvisoClinicaGate);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly aviso = signal<AvisoPublico | null>(null);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.privacidad.avisoVigente().subscribe({
      next: ({ data }) => {
        if (!data) {
          this.continuar();
          return;
        }
        this.aviso.set(data);
        this.cargando.set(false);
      },
      error: () => this.continuar()
    });
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
