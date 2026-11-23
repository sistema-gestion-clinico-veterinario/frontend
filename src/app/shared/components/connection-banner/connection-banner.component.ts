import { Component, inject } from '@angular/core';
import { ConnectionStatusService } from '../../../core/services/connection-status.service';

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  templateUrl: './connection-banner.component.html'
})
export class ConnectionBannerComponent {
  readonly conexion = inject(ConnectionStatusService);
}
