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
  readonly checked = signal<Record<number, boolean>>({});
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);

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

  toggle(docId: number, value: boolean): void {
    this.checked.update(state => ({ ...state, [docId]: value }));
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
