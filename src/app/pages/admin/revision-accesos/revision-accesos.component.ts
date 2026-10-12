import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import {
  AccessReviewDecision,
  AccessReviewDetail,
  AccessReviewItem,
  AccessReviewOverview,
  AccessReviewService,
  AccessReviewSummary
} from '../../../core/services/access-review.service';
import { AuthStore } from '../../../store/auth.store';

interface Decision {
  decision: AccessReviewDecision;
  comment: string;
}

@Component({
  selector: 'app-revision-accesos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ToastModule, SkeletonModule],
  providers: [MessageService],
  templateUrl: './revision-accesos.component.html'
})
export class RevisionAccesosComponent implements OnInit {
  private readonly service = inject(AccessReviewService);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly overview = signal<AccessReviewOverview | null>(null);
  readonly historial = signal<AccessReviewSummary[]>([]);
  readonly detalle = signal<AccessReviewDetail | null>(null);
  readonly decisiones = signal<Record<number, Decision>>({});
  readonly notas = signal('');
  readonly enviando = signal(false);
  readonly confirmando = signal(false);

  readonly puedeRegistrar = computed(() => this.authStore.hasAccess('VISTA_ROLES', 'modificar'));
  readonly items = computed(() => this.overview()?.items ?? []);
  readonly pendientes = computed(() => this.items().filter(item => !this.decisiones()[item.assignmentId]).length);
  readonly retiros = computed(
    () => this.items().filter(item => this.decisiones()[item.assignmentId]?.decision === 'REVOKE').length
  );
  readonly faltanMotivos = computed(() =>
    this.items().some(item => {
      const decision = this.decisiones()[item.assignmentId];
      return decision?.decision === 'REVOKE' && !decision.comment.trim();
    })
  );
  readonly listo = computed(() => this.items().length > 0 && this.pendientes() === 0 && !this.faltanMotivos());

  private get companyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.decisiones.set({});
    this.confirmando.set(false);
    this.service.obtener(this.companyId).subscribe({
      next: response => {
        this.overview.set(response.data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la revisión de accesos.');
        this.cargando.set(false);
      }
    });
    this.service.historial(this.companyId).subscribe({
      next: response => this.historial.set(response.data),
      error: () => this.historial.set([])
    });
  }

  decidir(item: AccessReviewItem, decision: AccessReviewDecision): void {
    const actual = this.decisiones()[item.assignmentId];
    this.decisiones.update(todas => ({
      ...todas,
      [item.assignmentId]: { decision, comment: actual?.comment ?? '' }
    }));
    this.confirmando.set(false);
  }

  motivo(item: AccessReviewItem, comment: string): void {
    this.decisiones.update(todas => ({
      ...todas,
      [item.assignmentId]: { decision: todas[item.assignmentId]?.decision ?? 'REVOKE', comment }
    }));
  }

  decisionDe(item: AccessReviewItem): Decision | undefined {
    return this.decisiones()[item.assignmentId];
  }

  solicitarRegistro(): void {
    if (!this.listo()) return;
    if (this.retiros() > 0) {
      this.confirmando.set(true);
      return;
    }
    this.registrar();
  }

  registrar(): void {
    if (!this.listo() || this.enviando()) return;
    this.enviando.set(true);
    const decisiones = this.items().map(item => {
      const decision = this.decisiones()[item.assignmentId];
      return {
        assignmentId: item.assignmentId,
        decision: decision.decision,
        comment: decision.decision === 'REVOKE' ? decision.comment.trim() : undefined
      };
    });
    this.service.registrar(decisiones, this.notas(), this.companyId).subscribe({
      next: () => {
        this.enviando.set(false);
        this.notas.set('');
        this.messageService.add({
          severity: 'success',
          summary: 'Revisión registrada',
          detail: 'La revisión de accesos quedó guardada.'
        });
        this.cargar();
      },
      error: err => {
        this.enviando.set(false);
        this.confirmando.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: err?.error?.message ?? 'Inténtalo nuevamente.'
        });
      }
    });
  }

  verDetalle(revision: AccessReviewSummary): void {
    this.service.detalle(revision.id, this.companyId).subscribe({
      next: response => this.detalle.set(response.data),
      error: () =>
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el detalle de la revisión.'
        })
    });
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }
}
