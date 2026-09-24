
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ItemCount } from '../../../models/response/reportes-clinicos-response';

/**
 * Forma "emphasis": destaca el elemento #1 en grande y deja el resto como una lista compacta y
 * apagada al lado — distinto tanto de la dona como de la lista numerada con barras que ya se usan
 * en otros paneles de "top N" de esta misma página.
 */
@Component({
  selector: 'app-reportes-emphasis',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (primero(); as top) {
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex shrink-0 flex-col items-center justify-center rounded-xl px-5 py-4 text-center text-white sm:w-36" [style.background]="color()">
          <span class="text-3xl font-extrabold leading-none">{{ top.count }}</span>
          <span class="mt-1.5 text-[11px] font-semibold leading-tight opacity-90">{{ top.label }}</span>
        </div>
        <ul class="min-w-0 flex-1 space-y-1.5">
          @for (item of resto(); track item) {
            <li class="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span class="truncate">{{ item.label }}</span>
              <span class="shrink-0 font-semibold text-slate-600">{{ item.count }}</span>
            </li>
          }
        </ul>
      </div>
    } @else {
      <div class="grid h-40 place-items-center text-center text-xs text-slate-400">Sin datos para los filtros seleccionados</div>
    }
    `
})
export class ReportesEmphasisComponent {
  readonly items = input<ItemCount[] | null>([]);
  readonly color = input('#4a3aa7');

  readonly primero = computed(() => this.items()?.[0] ?? null);
  readonly resto = computed(() => this.items()?.slice(1) ?? []);
}
