import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ItemCount } from '../../../models/response/reportes-clinicos-response';

/**
 * Medidor de una sola proporción contra el 100% (p. ej. "Al día" vs "Atrasado"), en vez de otra
 * dona más: un cumplimiento es una única cifra con un objetivo, no una identidad categórica —
 * el medidor lo comunica más directo que un círculo partido en dos.
 */
@Component({
  selector: 'app-reportes-meter',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-4">
      <div class="relative grid size-32 place-items-center">
        <svg viewBox="0 0 36 36" class="size-32 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" stroke-width="4"></circle>
          <circle
            cx="18" cy="18" r="15.5" fill="none" [attr.stroke]="color()" stroke-width="4"
            stroke-linecap="round"
            [attr.stroke-dasharray]="circumference"
            [attr.stroke-dashoffset]="circumference - (circumference * porcentaje()) / 100"
          ></circle>
        </svg>
        <div class="absolute flex flex-col items-center">
          <span class="text-2xl font-extrabold text-slate-800">{{ porcentaje() }}%</span>
          <span class="text-[10px] font-medium text-slate-400">al día</span>
        </div>
      </div>
      <div class="flex items-center gap-4 text-xs text-slate-500">
        <span class="flex items-center gap-1.5"><i class="inline-block size-2 rounded-full" [style.background]="color()"></i>{{ alDia() }} al día</span>
        <span class="flex items-center gap-1.5"><i class="inline-block size-2 rounded-full bg-slate-300"></i>{{ atrasado() }} atrasado</span>
      </div>
    </div>
  `
})
export class ReportesMeterComponent {
  readonly items = input<ItemCount[] | null>([]);
  readonly color = input('#0ca30c');

  readonly circumference = 2 * Math.PI * 15.5;

  readonly alDia = computed(() => this.items()?.find(i => i.label === 'Al día')?.count ?? 0);
  readonly atrasado = computed(() => this.items()?.find(i => i.label === 'Atrasado')?.count ?? 0);
  readonly porcentaje = computed(() => {
    const total = this.alDia() + this.atrasado();
    return total === 0 ? 0 : Math.round((this.alDia() / total) * 100);
  });
}
