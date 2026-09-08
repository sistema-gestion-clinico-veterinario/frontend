import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { LegalDocumentDTO, LegalService } from '../../../core/services/legal.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStore } from '../../../store/auth.store';
import { resolveDashboardRoute } from '../../../layouts/main-layout/navbar/navbar.component';

const LABELS: Record<LegalDocumentDTO['tipo'], string> = {
  TERMINOS_Y_CONDICIONES: 'Términos y Condiciones',
  POLITICA_PRIVACIDAD: 'Política de Privacidad'
};

@Component({
  selector: 'app-legal-accept',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './legal-accept.component.html',
  styleUrl: './legal-accept.component.scss'
})
export class LegalAcceptComponent implements OnInit {
  private readonly legalService = inject(LegalService);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly documents = signal<LegalDocumentDTO[]>([]);
  readonly checked = signal<Partial<Record<number, boolean>>>({});
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly currentIndex = signal(0);

  readonly currentDoc = computed<LegalDocumentDTO | null>(() => {
    const docs = this.documents();
    return docs[this.currentIndex()] ?? null;
  });

  readonly isLastDoc = computed(() => this.currentIndex() === this.documents().length - 1);
  readonly isFirstDoc = computed(() => this.currentIndex() === 0);

  readonly currentChecked = computed(() => {
    const doc = this.currentDoc();
    return doc ? !!this.checked()[doc.id] : false;
  });

  readonly allChecked = computed(() => {
    const docs = this.documents();
    const state = this.checked();
    return docs.length > 0 && docs.every(d => state[d.id]);
  });

  labelFor(doc: LegalDocumentDTO): string {
    return LABELS[doc.tipo] ?? doc.tipo;
  }

  ngOnInit(): void {
    this.legalService.getStatus().subscribe({
      next: ({ data }) => {
        this.documents.set(data.pendingDocuments);
        this.loading.set(false);
        if (!data.needsAcceptance) {
          this.router.navigateByUrl(resolveDashboardRoute(this.authStore.activeRolePurpose()));
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar el estado de aceptación. Intenta nuevamente.');
      }
    });
  }

  toggleCurrent(value: boolean): void {
    const doc = this.currentDoc();
    if (!doc) return;
    this.checked.update(state => ({ ...state, [doc.id]: value }));
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.documents().length) return;
    this.currentIndex.set(index);
  }

  next(): void {
    if (!this.currentChecked()) return;
    if (this.isLastDoc()) {
      this.submit();
      return;
    }
    this.currentIndex.update(i => i + 1);
  }

  back(): void {
    this.currentIndex.update(i => Math.max(0, i - 1));
  }

  submit(): void {
    if (!this.allChecked() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMsg.set(null);

    const ids = this.documents().map(d => d.id);
    this.legalService.accept(ids).pipe(
      finalize(() => this.submitting.set(false))
    ).subscribe({
      next: () => this.router.navigateByUrl(resolveDashboardRoute(this.authStore.activeRolePurpose())),
      error: () => this.errorMsg.set('No se pudo registrar la aceptación. Intenta nuevamente.')
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => {
        this.authStore.logout();
        this.router.navigateByUrl('/login');
      }
    });
  }
}
