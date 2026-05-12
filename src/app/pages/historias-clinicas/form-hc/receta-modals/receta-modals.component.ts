import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { PrescripcionResponse } from '../../../../models/response/prescripcion-response';

@Component({
  selector: 'app-receta-modals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './receta-modals.component.html',
  styleUrl: './receta-modals.component.scss'
})
export class RecetaModalsComponent {
  @Input() showForm = false;
  @Input() recetaEditando: PrescripcionResponse | null = null;
  @Input() consultaNombre = '';
  @Input() form!: FormGroup;
  @Input() showConfirmEliminar = false;
  @Input() recetaEliminando: PrescripcionResponse | null = null;

  @Output() cerrarForm         = new EventEmitter<void>();
  @Output() guardar            = new EventEmitter<void>();
  @Output() cancelarEliminar   = new EventEmitter<void>();
  @Output() confirmarEliminar  = new EventEmitter<void>();
}
