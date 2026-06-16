import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl } from '@angular/platform-browser';
import { ArchivoClinicoResponse } from '../../../../models/response/archivo-clinico-response';

@Component({
  selector: 'app-archivo-modals',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archivo-modals.component.html',
  styleUrl: './archivo-modals.component.scss'
})
export class ArchivoModalsComponent {
  @Input() previewArchivo: ArchivoClinicoResponse | null = null;
  @Input() previewUrl: SafeResourceUrl | string = '';
  @Input() previewTipo: 'imagen' | 'pdf' | 'dcm' | 'docx' | null = null;
  @Input() showConfirmEliminar = false;
  @Input() archivoEliminando: ArchivoClinicoResponse | null = null;

  @Output() cerrar            = new EventEmitter<void>();
  @Output() descargar         = new EventEmitter<ArchivoClinicoResponse>();
  @Output() cancelarEliminar  = new EventEmitter<void>();
  @Output() confirmarEliminar = new EventEmitter<void>();

  formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
