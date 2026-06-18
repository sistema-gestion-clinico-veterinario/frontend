import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProcessLoadingPanelComponent } from './shared/components/process-loading-panel/process-loading-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ProcessLoadingPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {}