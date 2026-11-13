import { ErrorHandler, Injectable, inject } from '@angular/core';
import { VersionNuevaService } from './version-nueva.service';

@Injectable()
export class ManejadorErroresGlobal extends ErrorHandler {
  private readonly version = inject(VersionNuevaService);

  override handleError(error: unknown): void {
    this.version.registrarError(error);
    super.handleError(error);
  }
}
