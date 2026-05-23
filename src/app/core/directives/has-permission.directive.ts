import { Directive, Input, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthStore } from '../../store/auth.store';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);

  private ventanaCodigo = '';
  private tipo: 'leer' | 'escribir' | 'modificar' | 'eliminar' = 'leer';

  @Input() set appHasPermission(value: string) {
    const parts = value.split(':');
    this.ventanaCodigo = parts[0];
    if (parts[1] === 'escribir' || parts[1] === 'modificar' || parts[1] === 'eliminar') {
      this.tipo = parts[1];
    } else {
      this.tipo = 'leer';
    }
    this.updateView();
  }

  ngOnInit() {
    this.updateView();
  }

  private updateView() {
    this.viewContainer.clear();
    const superAdmin = this.authStore.isSuperAdmin();
    if (!this.ventanaCodigo || superAdmin || this.authStore.hasAccess(this.ventanaCodigo, this.tipo)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
