import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { AvisoPublico } from '../../../models/privacy/privacidad.model';
import { AudienciaAvisoPrivacidad } from '../../../types/privacy/audiencia-aviso-privacidad.type';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-aviso-publico',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './aviso-publico.component.html'
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
