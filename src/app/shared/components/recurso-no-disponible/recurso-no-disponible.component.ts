import { Component, computed, input, output } from '@angular/core';

export type MotivoRecursoNoDisponible = 'NO_ENCONTRADO' | 'SIN_PERMISO' | 'FALLO';

export function motivoDeError(error: { status?: number } | null | undefined): MotivoRecursoNoDisponible {
  if (error?.status === 404) return 'NO_ENCONTRADO';
  if (error?.status === 403) return 'SIN_PERMISO';
  return 'FALLO';
}

@Component({
  selector: 'app-recurso-no-disponible',
  standalone: true,
  templateUrl: './recurso-no-disponible.component.html'
})
export class RecursoNoDisponibleComponent {
  readonly motivo = input.required<MotivoRecursoNoDisponible>();
  readonly nombre = input.required<string>();
  readonly femenino = input(false);
  readonly etiquetaVolver = input('Volver');

  readonly volver = output<void>();
  readonly reintentar = output<void>();

  private readonly demostrativo = computed(() => `${this.femenino() ? 'esta' : 'este'} ${this.nombre()}`);
  private readonly articulo = computed(() => `${this.femenino() ? 'la' : 'el'} ${this.nombre()}`);

  readonly contenido = computed(() => {
    const buscala = this.femenino() ? 'búscala' : 'búscalo';
    switch (this.motivo()) {
      case 'NO_ENCONTRADO':
        return {
          titulo: `No encontramos ${this.demostrativo()}`,
          detalle: `Puede que el enlace esté incompleto o que ${this.demostrativo()} ya no esté disponible para tu clínica. Vuelve a la lista y ${buscala} desde ahí.`
        };
      case 'SIN_PERMISO':
        return {
          titulo: `No tienes permiso para ver ${this.demostrativo()}`,
          detalle: 'Tu rol actual no puede abrir este contenido. Si lo necesitas para tu trabajo, solicita acceso al administrador de tu clínica.'
        };
      default:
        return {
          titulo: `No pudimos cargar ${this.articulo()}`,
          detalle: 'Algo salió mal de nuestro lado o se interrumpió tu conexión. Revisa tu internet e inténtalo de nuevo. Si el problema continúa, avisa al administrador de tu clínica.'
        };
    }
  });
}
