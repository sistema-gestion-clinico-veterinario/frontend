import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { AuthStore } from '../../store/auth.store';
import { ReportesClinicosService, ReportesClinicos, ItemCount } from '../../core/services/reportes-clinicos.service';
import { LoadingStore } from '../../store/loading.store';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss']
})
export default class ReportesComponent implements OnInit {
  private authStore = inject(AuthStore);
  private reportesService = inject(ReportesClinicosService);
  private loadingStore = inject(LoadingStore);

  data = signal<ReportesClinicos | null>(null);
  readonly today = new Date();

  totalConsultas = computed(() => this.data()?.consultasPorEstado?.reduce((s, i) => s + i.count, 0) ?? 0);
  totalDiagnosticos = computed(() => this.data()?.diagnosticosPorTipoYEstado?.reduce((s, i) => s + i.count, 0) ?? 0);
  totalTratamientos = computed(() => this.data()?.tratamientosPorEstado?.reduce((s, i) => s + i.count, 0) ?? 0);
  totalPacientes = computed(() => this.data()?.pacientesPorEspecie?.reduce((s, i) => s + i.count, 0) ?? 0);

  ngOnInit(): void {
    this.loadData();
  }

  private loadData() {
    this.loadingStore.show();
    const companyId = this.authStore.companyId() ?? undefined;
    this.reportesService.obtenerReportes(companyId).subscribe({
      next: (res) => {
        this.data.set(res.data);
        this.loadingStore.hide();
      },
      error: () => this.loadingStore.hide()
    });
  }

  maxCount(items: ItemCount[] | undefined): number {
    return Math.max(...(items?.map(i => i.count) ?? [0]), 1);
  }

  barWidth(item: ItemCount, items: ItemCount[] | undefined): number {
    return (item.count / this.maxCount(items)) * 100;
  }

  colors = ['#0066AA', '#9333EA', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444'];
  bgClasses = ['bg-blue-50', 'bg-purple-50', 'bg-pink-50', 'bg-amber-50', 'bg-emerald-50', 'bg-blue-50', 'bg-violet-50', 'bg-red-50'];
  textClasses = ['text-[#0066AA]', 'text-purple-600', 'text-pink-600', 'text-amber-600', 'text-emerald-600', 'text-blue-600', 'text-violet-600', 'text-red-500'];
  barClasses = ['bg-[#0066AA]', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-red-400'];
}
