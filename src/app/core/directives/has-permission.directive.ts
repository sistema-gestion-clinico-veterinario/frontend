import { Directive, Input, OnInit, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthStore } from '../../store/auth.store';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);

  private permission = '';

  @Input() set appHasPermission(permission: string) {
    this.permission = permission;
    this.updateView();
  }

  ngOnInit() {
    this.updateView();
  }

  private updateView() {
    this.viewContainer.clear();
    if (this.authStore.hasPermission(this.permission)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
