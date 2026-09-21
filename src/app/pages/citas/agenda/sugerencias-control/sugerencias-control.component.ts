import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoriaClinicaService } from '../../../../core/services/historia-clinica.service';
import { SugerenciaControlResponse } from '../../../../models/response/sugerencia-control-response';

/** Sugiere agendar una cita de control cuando un tratamiento está por finalizar o
 * un diagnóstico en seguimiento/crónico tiene una fecha de próximo control cercana.
 * Nunca agenda nada por su cuenta - solo prellena el formulario de "Nueva cita" para
 * que el personal confirme, igual que el resto de recordatorios del sistema. */
@Component({
  selector: 'app-sugerencias-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sugerencias-control.component.html'
})
export class SugerenciasControlComponent implements OnInit {
  private readonly hcService = inject(HistoriaClinicaService);

  @Output() agendarControl = new EventEmitter<SugerenciaControlResponse>();

  sugerencias = signal<SugerenciaControlResponse[]>([]);
  colapsado = signal<boolean>(false);

  ngOnInit(): void {
    this.hcService.listarSugerenciasControl(7).subscribe({
      next: (res) => this.sugerencias.set(res.data ?? []),
      error: () => this.sugerencias.set([])
    });
  }

  urgenciaClase(dias: number): string {
    if (dias <= 1) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (dias <= 3) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  etiquetaDias(dias: number): string {
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    return `En ${dias} días`;
  }
}
