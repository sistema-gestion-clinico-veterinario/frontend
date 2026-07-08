import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { PrescripcionResponse } from '../../../models/response/prescripcion-response';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { hasMeaningfulText, isDateRangeValid } from '../../../core/utils/input-validation.util';

@Component({
  selector: 'app-lista-recetas',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    PaginatorModule,
    InputTextModule,
    FormsModule
  ],
  templateUrl: './lista-recetas.component.html'
})
export class ListaRecetasComponent implements OnInit {
  private readonly hcService = inject(HistoriaClinicaService);
  readonly loadingStore = inject(LoadingStore);
  readonly authStore    = inject(AuthStore);

  recetas = signal<PrescripcionResponse[]>([]);
  selectedReceta = signal<PrescripcionResponse | null>(null);
  totalRecords = signal(0);
  currentPage = 0;
  readonly pageSize = 10;
  searchQuery = '';
  nombreMascota = '';
  numeroMicrochip = '';
  numeroDocumentoApoderado = '';
  numeroDocumentoEmpleado = '';
  numeroHc = '';
  fechaDesde = '';
  fechaHasta = '';

  ngOnInit() {
    this.cargarRecetas();
  }

  get activeCompanyId(): number | undefined {
    return this.authStore.selectedEnterprise()?.establishmentId ?? undefined;
  }

  cargarRecetas(page: number = 0) {
    this.currentPage = page;
    this.loadingStore.show();
    const query = normalizeText(this.searchQuery).slice(0, 80);
    const nombreMascota = normalizeText(this.nombreMascota).slice(0, 80);
    const numeroMicrochip = normalizeText(this.numeroMicrochip).slice(0, 50);
    const numeroDocumentoApoderado = normalizeText(this.numeroDocumentoApoderado).slice(0, 20);
    const numeroDocumentoEmpleado = normalizeText(this.numeroDocumentoEmpleado).slice(0, 20);
    const numeroHc = normalizeText(this.numeroHc).slice(0, 30);

    if (!isDateRangeValid(this.fechaDesde, this.fechaHasta)) {
      this.loadingStore.hide();
      return;
    }
    if ((query && !hasMeaningfulText(query, false)) || (nombreMascota && !hasMeaningfulText(nombreMascota))) {
      this.loadingStore.hide();
      return;
    }

    this.hcService.buscarRecetas({
      query,
      companyId: this.activeCompanyId,
      nombreMascota: nombreMascota || undefined,
      numeroMicrochip: numeroMicrochip || undefined,
      numeroDocumentoApoderado: numeroDocumentoApoderado || undefined,
      numeroDocumentoEmpleado: numeroDocumentoEmpleado || undefined,
      numeroHc: numeroHc || undefined,
      fechaDesde: this.fechaDesde || undefined,
      fechaHasta: this.fechaHasta || undefined
    }, page, this.pageSize).subscribe({
      next: (res) => {
        if (res.data) {
          this.recetas.set(res.data.content);
          this.totalRecords.set(res.data?.page?.totalElements ?? res.data?.totalElements ?? 0);
        }
        this.loadingStore.hide();
      },
      error: () => this.loadingStore.hide()
    });
  }

  onFilterChange() {
    this.cargarRecetas(0);
  }

  onPageChange(event: any) {
    this.cargarRecetas(event.page);
  }

  resetFiltros() {
    this.searchQuery = '';
    this.nombreMascota = '';
    this.numeroMicrochip = '';
    this.numeroDocumentoApoderado = '';
    this.numeroDocumentoEmpleado = '';
    this.numeroHc = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.cargarRecetas(0);
  }

  verReceta(receta: PrescripcionResponse) {
    this.selectedReceta.set(receta);
  }

  cerrarDetalle() {
    this.selectedReceta.set(null);
  }

  imprimirReceta(receta: PrescripcionResponse) {
    const hoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const safe = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] ?? char));
    const medicamento = safe(receta.medicamento);
    const principioActivo = safe(receta.principioActivo);
    const dosis = safe(receta.dosis);
    const frecuencia = safe(receta.frecuencia);
    const viaAdministracion = safe(receta.viaAdministracion);
    const instrucciones = safe(receta.instrucciones);
    const pacienteNombre = safe(receta.pacienteNombre);
    const numeroHcSeguro = safe(receta.numeroHc ?? '-');
    const veterinarioNombre = safe(receta.veterinarioNombre || 'Medico Veterinario');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Receta Médica</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 32px; }
    .header { border-bottom: 2px solid #0066AA; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .logo-area h1 { font-size: 20px; font-weight: bold; color: #0066AA; }
    .logo-area p { font-size: 11px; color: #64748b; margin-top: 2px; }
    .fecha { font-size: 11px; color: #64748b; text-align: right; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field label { font-size: 10px; color: #94a3b8; font-weight: bold; }
    .field p { font-size: 12px; color: #1e293b; font-weight: bold; margin-top: 2px; }
    .rx-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .rx-med { font-size: 15px; font-weight: bold; color: #0066AA; margin-bottom: 8px; }
    .rx-detail { display: flex; gap: 24px; margin-bottom: 8px; }
    .rx-detail .item label { font-size: 10px; color: #94a3b8; font-weight: bold; }
    .rx-detail .item p { font-size: 12px; font-weight: bold; }
    .indicaciones { background: #f8fafc; border-radius: 6px; padding: 10px; margin-top: 8px; font-size: 11px; color: #475569; font-style: italic; }
    .firma { margin-top: 48px; text-align: right; }
    .firma .line { border-top: 1px solid #1e293b; width: 220px; display: inline-block; margin-bottom: 4px; }
    .firma p { font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>Clínica Veterinaria Vargas Vet</h1>
      <p>Receta Médica Veterinaria</p>
    </div>
    <div class="fecha">
      <p>Fecha: <strong>${hoy}</strong></p>
      <p>HC: <strong>${numeroHcSeguro}</strong></p>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Datos del paciente</div>
    <div class="grid-2">
      <div class="field"><label>Paciente</label><p>${pacienteNombre || '-'}</p></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Medicamento prescrito</div>
    <div class="rx-box">
      <div class="rx-med">Rx &nbsp;${medicamento}${principioActivo ? ' <span style="font-size:12px;color:#64748b;font-weight:normal;">(' + principioActivo + ')</span>' : ''}</div>
      <div class="rx-detail">
        <div class="item"><label>Dosis</label><p>${dosis}</p></div>
        <div class="item"><label>Frecuencia</label><p>${frecuencia}</p></div>
        <div class="item"><label>Vía</label><p>${viaAdministracion}</p></div>
        <div class="item"><label>Duración</label><p>${receta.duracionDias ? receta.duracionDias + ' días' : '—'}</p></div>
      </div>
      <div class="grid-2" style="margin-top:8px;">
        <div class="field"><label>Fecha inicio</label><p>${receta.fechaInicio ? new Date(receta.fechaInicio).toLocaleDateString('es-PE') : '—'}</p></div>
        <div class="field"><label>Fecha fin</label><p>${receta.fechaFin ? new Date(receta.fechaFin).toLocaleDateString('es-PE') : '—'}</p></div>
      </div>
      ${instrucciones ? '<div class="indicaciones"><strong>Indicaciones:</strong> ' + instrucciones + '</div>' : ''}
    </div>
  </div>
  <div class="firma">
    <div class="line"></div><br>
    <p><strong>${veterinarioNombre}</strong></p>
    <p>Médico Veterinario</p>
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    iframe.contentDocument!.open();
    iframe.contentDocument!.write(html);
    iframe.contentDocument!.close();
    iframe.contentWindow!.onafterprint = () => document.body.removeChild(iframe);
    setTimeout(() => iframe.contentWindow!.print(), 300);
  }
}
