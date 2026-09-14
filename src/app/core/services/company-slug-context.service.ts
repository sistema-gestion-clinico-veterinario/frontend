import { Injectable, signal } from '@angular/core';

/**
 * Fuente de verdad del slug de empresa que se muestra en la URL. La lee y
 * escribe el SlugUrlSerializer (para que la barra de direcciones siempre
 * lleve el slug sin que cada pantalla tenga que saberlo) y SessionService
 * la actualiza con el slug real de la sesion autenticada al iniciar sesion
 * o restaurarla, para que quede sincronizada aunque el login haya sido
 * "global" (sin slug en la URL).
 */
@Injectable({ providedIn: 'root' })
export class CompanySlugContext {
  private readonly slugSignal = signal<string | null>(null);
  readonly slug = this.slugSignal.asReadonly();

  setSlug(slug: string | null): void {
    this.slugSignal.set(slug);
  }

  clear(): void {
    this.slugSignal.set(null);
  }
}
