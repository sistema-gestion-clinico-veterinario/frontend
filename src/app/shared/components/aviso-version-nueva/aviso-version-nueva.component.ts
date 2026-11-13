import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VersionNuevaService } from '../../../core/services/version-nueva.service';

@Component({
  selector: 'app-aviso-version-nueva',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  templateUrl: './aviso-version-nueva.component.html'
})
export class AvisoVersionNuevaComponent {
  readonly version = inject(VersionNuevaService);
}
