import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect
} from '@angular/core';

import { AuthStore } from '../../store/auth.store';

type PermissionType =
  | 'leer'
  | 'escribir'
  | 'modificar'
  | 'eliminar';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {

  private readonly authStore = inject(AuthStore);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);

  private ventanaCodigo = '';

  private tipo: PermissionType = 'leer';

  @Input()
  set appHasPermission(value: string) {

    if (!value) {
      this.ventanaCodigo = '';
      this.tipo = 'leer';
      this.updateView();
      return;
    }

    /**
     * Ejemplo:
     * APODERADOS:escribir
     */

    const parts = value.split(':');

    this.ventanaCodigo = parts[0]?.trim();

    const action = parts[1]?.trim().toLowerCase();

    if (
      action === 'leer' ||
      action === 'escribir' ||
      action === 'modificar' ||
      action === 'eliminar'
    ) {
      this.tipo = action;
    } else {
      this.tipo = 'leer';
    }

    this.updateView();
  }

  constructor() {

    /**
     * Reacciona automáticamente cuando:
     * - cambia el menú
     * - cambian permisos
     * - cambia simulación de roles
     */

    effect(() => {

      // Escuchar signals
      this.authStore.menu();
      this.authStore.roles();

      // Re-renderizar
      this.updateView();
    });
  }

  private updateView(): void {

    // Limpiar contenido anterior
    this.viewContainer.clear();

    // Si no hay código de ventana
    if (!this.ventanaCodigo) {
      return;
    }

    // SUPER ADMIN
    const superAdmin = this.authStore.isSuperAdmin();

    // ADMIN
    const isAdmin = this.authStore.roles().some(
      (r: string) =>
        r === 'ROLE_ADMIN' ||
        r === 'ADMIN'
    );

    // Permiso dinámico
    const hasPermission = this.authStore.hasAccess(
      this.ventanaCodigo,
      this.tipo
    );

    // Mostrar elemento
    if (
      superAdmin ||
      isAdmin ||
      hasPermission
    ) {
      this.viewContainer.createEmbeddedView(
        this.templateRef
      );
    }
  }
}
