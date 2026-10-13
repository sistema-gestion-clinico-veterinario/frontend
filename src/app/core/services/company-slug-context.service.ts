import { Injectable, signal } from '@angular/core';
import { companySlugFromUrl } from '../routing/slug-url.utils';

@Injectable({ providedIn: 'root' })
export class CompanySlugContext {
  private readonly slugSignal = signal<string | null>(this.readInitialSlug());
  readonly slug = this.slugSignal.asReadonly();

  setSlug(slug: string | null): void {
    this.slugSignal.set(slug);
  }

  clear(): void {
    this.slugSignal.set(null);
  }

  private readInitialSlug(): string | null {
    return typeof window === 'undefined' ? null : companySlugFromUrl(window.location.pathname);
  }
}
