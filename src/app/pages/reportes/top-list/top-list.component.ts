
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ItemCount } from '../../../models/response/reportes-clinicos-response';

/**
 * Ranking "Top N" como lista numerada con barra inline, en vez de otro gráfico de barras más.
 * Pensado para paneles donde antes se repetía el mismo tipo de gráfico de la página (ver queja
 * de usuario: demasiados gráficos de barras idénticos con distintos datos).
 */
@Component({
  selector: 'app-reportes-top-list',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2.5">
      @for (item of items() ?? []; track item; let i = $index) {
        <div class="flex items-center gap-3">
          <span
            class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
            [style.background]="i === 0 ? colorHue() : '#f1f5f9'"
            [style.color]="i === 0 ? '#fff' : '#64748b'"
          >{{ i + 1 }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
              <span class="truncate text-xs font-medium text-slate-700">{{ item.label }}</span>
              <span class="shrink-0 text-xs font-bold text-slate-900">{{ item.count }}</span>
            </div>
            <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full" [style.width.%]="(item.count / maxValue()) * 100" [style.background]="colorHue()"></div>
            </div>
          </div>
        </div>
      }
      @if (!items()?.length) {
        <div class="grid h-40 place-items-center text-center text-xs text-slate-400">
          Sin datos para los filtros seleccionados
        </div>
      }
    </div>
    `
})
export class ReportesTopListComponent {
  readonly items = input<ItemCount[] | null>([]);
  readonly colorHue = input('#1baf7a');

  readonly maxValue = computed(() => Math.max(1, ...(this.items() ?? []).map(item => item.count)));
}
