import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AudienciaAvisoPrivacidad, AvisoPublico, PrivacidadService } from '../../../core/services/privacidad.service';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-aviso-publico',
  standalone: true,
  imports: [DatePipe],
  template: `
    <main class="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:py-12">
      @if (cargando()) {
        <p class="text-center text-sm text-slate-500">Cargando el aviso de privacidad…</p>
      } @else if (aviso(); as a) {
        <header class="mb-6 flex items-center gap-4 border-b border-slate-200 pb-5" [style.border-color]="a.colorPrimario">
          @if (a.logoUrl) {
            <img [src]="a.logoUrl" alt="" class="h-14 w-14 rounded-lg object-contain" />
          }
          <div>
            <h1 class="text-xl font-extrabold text-slate-900">{{ a.clinica }}</h1>
            <p class="text-sm text-slate-500">Versión {{ a.version }} · vigente desde {{ a.vigenteDesde | date: 'dd/MM/yyyy' }}</p>
          </div>
        </header>
        <article class="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 sm:p-8">{{ a.contenido }}</article>
      } @else {
        <p class="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-600">{{ mensaje() }}</p>
      }
    </main>
  `
})
export class AvisoPublicoComponent implements OnInit {
  private readonly privacidad = inject(PrivacidadService);
  private readonly slugContext = inject(CompanySlugContext);
  private readonly route = inject(ActivatedRoute);

  readonly aviso = signal<AvisoPublico | null>(null);
  readonly cargando = signal(true);
  readonly mensaje = signal('');

  ngOnInit(): void {
    const slug = this.slugContext.slug();
    if (!slug) {
      this.cargando.set(false);
      this.mensaje.set('No identificamos la clínica. Abre este enlace desde la página de ingreso de tu clínica.');
      return;
    }
    const audiencia: AudienciaAvisoPrivacidad = this.route.snapshot.queryParamMap.get('audiencia') === 'TRABAJADORES_Y_USUARIOS'
      ? 'TRABAJADORES_Y_USUARIOS'
      : 'PROPIETARIOS_Y_AUTORIZADOS';
    const versionParam = Number(this.route.snapshot.queryParamMap.get('version'));
    const solicitud = Number.isInteger(versionParam) && versionParam > 0
      ? this.privacidad.avisoPublicoVersion(slug, versionParam, audiencia)
      : this.privacidad.avisoPublico(slug, audiencia);
    solicitud.subscribe({
      next: ({ data }) => {
        this.aviso.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.mensaje.set(err.status === 404
          ? 'Esta clínica aún no publicó su aviso de privacidad.'
          : 'No se pudo cargar el aviso de privacidad. Intenta nuevamente.');
      }
    });
  }
}
