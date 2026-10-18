import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { BackupMonitorService } from '../../../core/services/backup-monitor.service';
import {
  BackupComponentStatus,
  BackupExecution,
  BackupRunStatus
} from '../../../models/backup/backup-execution.model';

@Component({
  selector: 'app-backup-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backup-monitor.component.html'
})
export class BackupMonitorComponent implements OnInit {
  private readonly service = inject(BackupMonitorService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly executions = signal<BackupExecution[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pageSize = 20;
  readonly latest = computed(() => this.executions()[0] ?? null);
  readonly hasPreviousPage = computed(() => this.page() > 0);
  readonly hasNextPage = computed(() => (this.page() + 1) * this.pageSize < this.total());

  ngOnInit(): void {
    this.load(0);
  }

  load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.list(page, this.pageSize).subscribe({
      next: response => {
        this.executions.set(response.data.content ?? []);
        this.total.set(response.data.totalElements ?? response.data.page?.totalElements ?? 0);
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo consultar el estado de los respaldos.');
        this.loading.set(false);
      }
    });
  }

  statusLabel(status: BackupRunStatus): string {
    return ({ IN_PROGRESS: 'En ejecución', SUCCESS: 'Completo', PARTIAL: 'Parcial', FAILED: 'Fallido' })[status];
  }

  componentLabel(status: BackupComponentStatus): string {
    return ({ PENDING: 'Pendiente', SUCCESS: 'Correcto', FAILED: 'Fallido', SKIPPED: 'No incluido' })[status];
  }

  statusClass(status: BackupRunStatus | BackupComponentStatus): string {
    if (status === 'SUCCESS') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'FAILED') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (status === 'PARTIAL' || status === 'SKIPPED') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  policyLabel(policy: BackupExecution['retentionPolicy']): string {
    if (!policy) return 'No registrada';
    return ({ p01: 'Diario · 30 días', p02: 'Semanal · 180 días', p03: 'Mensual · 365 días' } as const)[policy];
  }

  duration(execution: BackupExecution): string {
    if (!execution.finishedAt) return 'En curso';
    const seconds = Math.max(0, Math.round(
      (new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000
    ));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes > 0 ? `${minutes} min ${remainder} s` : `${remainder} s`;
  }

  shortId(value: string | null): string {
    return value ? value.slice(0, 8) : 'Pendiente';
  }
}
