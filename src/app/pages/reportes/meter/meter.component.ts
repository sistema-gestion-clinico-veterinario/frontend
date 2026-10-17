import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ItemCount } from '../../../models/response/reportes-clinicos-response';

@Component({
  selector: 'app-reportes-meter',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meter.component.html'
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
