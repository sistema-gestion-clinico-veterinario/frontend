import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { CentroLegalPublico, DocumentoCentroLegal } from '../../../models/privacy/privacidad.model';
import { AudienciaAvisoPrivacidad } from '../../../types/privacy/audiencia-aviso-privacidad.type';
import { CompanySlugContext } from '../../../core/services/company-slug-context.service';
import { ActivatedRoute, Router } from '@angular/router';

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
  private readonly router = inject(Router);

  readonly centro = signal<CentroLegalPublico | null>(null);
  readonly documentoSeleccionado = signal<DocumentoCentroLegal['codigo']>('AVISO_PRIVACIDAD');
  readonly cargando = signal(true);
  readonly mensaje = signal('');
  readonly documento = computed(() => this.centro()?.documentos.find(
    documento => documento.codigo === this.documentoSeleccionado()) ?? null);

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
    const version = Number.isInteger(versionParam) && versionParam > 0 ? versionParam : undefined;
    this.privacidad.centroLegalPublico(slug, audiencia, version).subscribe({
      next: ({ data }) => {
        this.centro.set(data);
        const solicitado = this.route.snapshot.queryParamMap.get('documento');
        const existe = data.documentos.some(documento => documento.codigo === solicitado);
        this.documentoSeleccionado.set(existe
          ? solicitado as DocumentoCentroLegal['codigo']
          : data.documentos[0]?.codigo ?? 'AVISO_PRIVACIDAD');
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.mensaje.set(err.status === 404
          ? 'Esta clínica aún no publicó sus documentos legales.'
          : 'No se pudieron cargar los documentos legales. Intenta nuevamente.');
      }
    });
  }

  seleccionar(codigo: DocumentoCentroLegal['codigo']): void {
    if (!this.centro()?.documentos.some(documento => documento.codigo === codigo)) return;
    this.documentoSeleccionado.set(codigo);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { documento: codigo === 'AVISO_PRIVACIDAD' ? null : codigo },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  onSeleccionMovil(event: Event): void {
    this.seleccionar((event.target as HTMLSelectElement).value as DocumentoCentroLegal['codigo']);
  }

  imprimir(): void {
    window.print();
  }
}
