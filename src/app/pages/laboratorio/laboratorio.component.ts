import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LaboratorioIaService } from '../../core/services/laboratorio-ia.service';
import { LaboratorioIAResponse, ParametroClinico } from '../../models/response/laboratorio-ia-response';

@Component({
  selector: 'app-laboratorio',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './laboratorio.component.html',
})
export class LaboratorioComponent {
  private readonly service = inject(LaboratorioIaService);
  private readonly toast   = inject(MessageService);

  archivo   = signal<File | null>(null);
  especie   = signal<string>('Perro');
  cargando  = signal(false);
  resultado = signal<LaboratorioIAResponse | null>(null);
  arrastrar = signal(false);

  readonly ESPECIES = ['Perro', 'Gato'];

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setArchivo(input.files[0]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastrar.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.setArchivo(file);
  }

  private setArchivo(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const validas = ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'tiff'];
    if (!validas.includes(ext)) {
      this.toast.add({ severity: 'warn', summary: 'Formato no válido', detail: 'Use PDF, JPG o PNG.' });
      return;
    }
    this.archivo.set(file);
    this.resultado.set(null);
  }

  analizar(): void {
    const file = this.archivo();
    if (!file) return;
    this.cargando.set(true);
    this.resultado.set(null);

    this.service.analizar(file, this.especie()).subscribe({
      next: res => {
        this.resultado.set(res);
        this.cargando.set(false);
        this.toast.add({ severity: 'success', summary: 'Análisis completado', detail: `${res.secciones_presentes.length} sección(es) extraídas` });
      },
      error: err => {
        this.cargando.set(false);
        const msg = err?.error?.message ?? 'No se pudo conectar con el servicio de IA.';
        this.toast.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  limpiar(): void {
    this.archivo.set(null);
    this.resultado.set(null);
  }

  estadoClass(estado: string): string {
    if (estado === 'alto')  return 'bg-red-50 text-red-600';
    if (estado === 'bajo')  return 'bg-amber-50 text-amber-600';
    return 'bg-green-50 text-green-700';
  }

  estadoDot(estado: string): string {
    if (estado === 'alto')  return 'bg-red-500';
    if (estado === 'bajo')  return 'bg-amber-400';
    return 'bg-green-500';
  }

  tieneSeccion(sec: string): boolean {
    return this.resultado()?.secciones_presentes.includes(sec) ?? false;
  }

  trackByTest(_: number, p: ParametroClinico) { return p.test; }
}
