import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ItemCount } from '../../../models/response/reportes-clinicos-response';

@Component({
  selector: 'app-reportes-emphasis',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './emphasis.component.html'
})
export class ReportesEmphasisComponent {
  readonly items = input<ItemCount[] | null>([]);
  readonly color = input('#4a3aa7');

  readonly primero = computed(() => this.items()?.[0] ?? null);
  readonly resto = computed(() => this.items()?.slice(1) ?? []);
}
