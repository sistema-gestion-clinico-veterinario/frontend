import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { finalize } from 'rxjs';
import { CitaService } from '../../../core/services/cita.service';
import { EmpleadoService } from '../../../core/services/empleado.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { CitaResponse } from '../../../models/response/cita-response';
import { EmpleadoListResponse } from '../../../models/response/empleado-list-response';

/** Panel de resolución de citas conflictivas: se muestra cuando se intenta
 * suspender un empleado o un cliente que aún tiene citas vigentes, porque el
 * backend bloquea esa acción hasta que se resuelvan (ver ApoderadoServiceImpl /
 * EmpleadoServiceImpl .cambiarEstado). Para un empleado, cada cita se reasigna a
 * otro veterinario (misma fecha/hora, sin reprogramar). Para un cliente, cada
 * cita se cancela, porque no existe "reasignar" para un apoderado que ya no será
 * cliente activo. */
@Component({
  selector: 'app-conflicting-appointments-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, SelectModule, Textarea, ToastModule],
  providers: [MessageService],
  templateUrl: './conflicting-appointments-dialog.component.html'
})
export class ConflictingAppointmentsDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() mode: 'empleado' | 'apoderado' = 'empleado';
  @Input() entityId: number | null = null;
  @Input() entityLabel = '';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() resolved = new EventEmitter<void>();

  private readonly citaService = inject(CitaService);
  private readonly empleadoService = inject(EmpleadoService);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly citas = signal<CitaResponse[]>([]);
  readonly empleadosActivos = signal<EmpleadoListResponse[]>([]);
  readonly seleccion = signal<Record<number, number | null>>({});
  readonly motivo = signal<Record<number, string>>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.entityId) {
      this.cargar();
      if (this.mode === 'empleado') {
        this.cargarEmpleadosActivos();
      }
    }
  }

  private cargar(): void {
    if (!this.entityId) return;
    this.loading.set(true);
    const request$ = this.mode === 'empleado'
      ? this.empleadoService.citasConflictivas(this.entityId)
      : this.apoderadoService.citasConflictivas(this.entityId);
    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: res => this.citas.set(res.data ?? []),
      error: () => this.messages.add({ severity: 'error', summary: 'No se pudo cargar', detail: 'No se pudieron obtener las citas vigentes.' })
    });
  }

  private cargarEmpleadosActivos(): void {
    this.empleadoService.listar(undefined, undefined, 0, 200).subscribe({
      next: res => this.empleadosActivos.set((res.data?.content ?? []).filter(e => e.activo && e.id !== this.entityId))
    });
  }

  seleccionarVeterinario(citaId: number, veterinarioId: number): void {
    this.seleccion.update(s => ({ ...s, [citaId]: veterinarioId }));
  }

  actualizarMotivo(citaId: number, valor: string): void {
    this.motivo.update(m => ({ ...m, [citaId]: valor }));
  }

  reasignar(cita: CitaResponse): void {
    const veterinarioId = this.seleccion()[cita.id];
    if (!veterinarioId) {
      this.messages.add({ severity: 'warn', summary: 'Selecciona un veterinario', detail: 'Debes elegir a quién reasignar la cita.' });
      return;
    }
    this.saving.set(true);
    this.citaService.reasignarVeterinario(cita.id, veterinarioId, this.motivo()[cita.id]).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Cita reasignada', detail: 'Se notificó al cliente por correo.' });
        this.cargar();
      },
      error: err => this.messages.add({ severity: 'error', summary: 'No se pudo reasignar', detail: err.error?.message || 'Ocurrió un error al reasignar la cita.' })
    });
  }

  cancelar(cita: CitaResponse): void {
    const motivo = this.motivo()[cita.id]?.trim();
    if (!motivo) {
      this.messages.add({ severity: 'warn', summary: 'Motivo requerido', detail: 'Explica el motivo de la cancelación.' });
      return;
    }
    this.saving.set(true);
    this.citaService.cancelarCita(cita.id, motivo).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Cita cancelada', detail: 'La cita fue cancelada.' });
        this.cargar();
      },
      error: err => this.messages.add({ severity: 'error', summary: 'No se pudo cancelar', detail: err.error?.message || 'Ocurrió un error al cancelar la cita.' })
    });
  }

  cerrar(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    if (this.citas().length === 0) {
      this.resolved.emit();
    }
  }
}
