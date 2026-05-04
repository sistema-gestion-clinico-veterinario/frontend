import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LoadingStore } from './store/loading.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div *ngIf="loadingStore.isLoading()" class="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-sm animate-fade-in">
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 border-4 border-[#0066AA]/20 border-t-[#0066AA] rounded-full animate-spin"></div>
        <p class="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Procesando solicitud...</p>
      </div>
    </div>
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  readonly loadingStore = inject(LoadingStore);
}
