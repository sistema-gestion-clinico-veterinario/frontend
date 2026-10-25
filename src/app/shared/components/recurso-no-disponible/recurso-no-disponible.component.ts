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
    switch (this.motivo()) {
      case 'NO_ENCONTRADO':
        return {
          icono: 'pi pi-search',
          titulo: `No encontramos ${this.demostrativo()}`,
          detalle: `El enlace no es válido o ${this.demostrativo()} no pertenece a tu clínica. Vuelve a la lista y búscal${this.femenino() ? 'a' : 'o'} desde ahí.`
        };
      case 'SIN_PERMISO':
        return {
          icono: 'pi pi-lock',
          titulo: `No tienes acceso a ${this.demostrativo()}`,
          detalle: 'Tu rol no permite ver este contenido. Si lo necesitas, pide acceso al administrador de tu clínica.'
        };
      default:
        return {
          icono: 'pi pi-exclamation-triangle',
          titulo: `No se pudo cargar ${this.articulo()}`,
          detalle: 'Hubo un problema al conectar con el servidor. Inténtalo de nuevo en unos segundos.'
        };
    }
  });
}
