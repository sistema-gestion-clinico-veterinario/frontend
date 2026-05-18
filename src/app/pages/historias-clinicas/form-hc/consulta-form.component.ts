import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { BadgeModule } from 'primeng/badge';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { ConsultaResponse } from '../../../models/response/consulta-response';
import { PrescripcionResponse } from '../../../models/response/prescripcion-response';
import { PrescripcionRequest } from '../../../models/request/prescripcion-request';

@Component({
  selector: 'app-consulta-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    ConfirmDialogModule,
    TimelineModule,
    CardModule,
    DrawerModule,
    BadgeModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './consulta-form.component.html'
})
export class ConsultaFormComponent implements OnInit {
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly fb          = inject(FormBuilder);
  private readonly hcService   = inject(HistoriaClinicaService);
  private readonly msgService  = inject(MessageService);
  private readonly confirmSvc  = inject(ConfirmationService);
  readonly loadingStore        = inject(LoadingStore);

  consulta   = signal<ConsultaResponse | null>(null);
  historia   = signal<any | null>(null); 
  tabActiva  = signal<'signos' | 'clinico' | 'antecedentes' | 'historial' | 'recetas'>('signos');
  isCerrada  = signal<boolean>(false);
  consultaId = 0;
  displayDetalleHistorial = signal<boolean>(false);
  detalleSeleccionado      = signal<any | null>(null);

  recetas            = signal<PrescripcionResponse[]>([]);
  showRecetaModal    = signal<boolean>(false);
  recetaEditando     = signal<PrescripcionResponse | null>(null);
  recetaEliminando   = signal<PrescripcionResponse | null>(null);
  showConfirmEliminar = signal<boolean>(false);

  recetaForm: FormGroup = this.fb.group({
    medicamento:       ['', Validators.required],
    principioActivo:   [''],
    dosis:             ['', Validators.required],
    frecuencia:        ['', Validators.required],
    duracionDias:      [null],
    viaAdministracion: ['', Validators.required],
    instrucciones:     [''],
    fechaInicio:       ['', Validators.required],
    fechaFin:          [''],
  });

  readonly tiposConsulta = [
    { label: 'Primera vez',      value: 'PRIMERA_VEZ'      },
    { label: 'Seguimiento',      value: 'SEGUIMIENTO'      },
    { label: 'Control rutina',   value: 'CONTROL_RUTINA'   },
    { label: 'Emergencia',       value: 'EMERGENCIA'       },
    { label: 'Cirugía',          value: 'CIRUGIA'          },
    { label: 'Vacunación',       value: 'VACUNACION'       },
    { label: 'Desparasitación',  value: 'DESPARASITACION'   },
    { label: 'Otro',             value: 'OTRO'             },
  ];

  form: FormGroup = this.fb.group({
    version:                 [null, Validators.required],
    tipoConsulta:            [null, Validators.required],
    motivoConsulta:          ['',   Validators.required],
    pesoEnConsulta:          [null, [Validators.required, Validators.min(0)]],
    temperatura:             [null, Validators.min(0)],
    frecuenciaCardiaca:      [null, Validators.min(0)],
    frecuenciaRespiratoria:  [null, Validators.min(0)],
    mucosas:                 [''],
    turgenciaPiel:           [''],
    vacunacionAlDia:         [false],
    desparasitacionAlDia:    [false],
    anamnesis:               ['',   Validators.required],
    examenFisico:            [''],
    observaciones:           [''],
    antecedentesEnfermedades:    [''],
    antecedentesProcedimientos:  [''],
    antecedentesPersonales:      [''],
    antecedentesFamiliares:      [''],
    grupoSanguineo:              [''],
    indicacionesReceta:          [''],
  });

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.consultaId = Number(params['consultaId']);
      if (!this.consultaId) {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'ID de consulta no válido' });
        this.router.navigate(['/citas/agenda']);
        return;
      }
      this.loadConsulta();
    });
  }

  loadConsulta() {
    this.loadingStore.show();
    this.hcService.getConsulta(this.consultaId).subscribe({
      next: (res) => {
        this.consulta.set(res.data);
        this.isCerrada.set(res.data.estado === 'CERRADA');
        if (res.data.mascotaId) {
          this.loadHistoria(res.data.mascotaId);
        }
        this.loadRecetas();

        this.form.patchValue({
          tipoConsulta:            res.data.tipoConsulta           ?? null,
          motivoConsulta:          res.data.motivoConsulta         ?? '',
          pesoEnConsulta:          res.data.pesoEnConsulta         ?? null,
          temperatura:             res.data.temperatura            ?? null,
          frecuenciaCardiaca:      res.data.frecuenciaCardiaca     ?? null,
          frecuenciaRespiratoria:  res.data.frecuenciaRespiratoria ?? null,
          mucosas:                 res.data.mucosas                ?? '',
          turgenciaPiel:           res.data.turgenciaPiel          ?? '',
          vacunacionAlDia:         res.data.vacunacionAlDia        ?? false,
          desparasitacionAlDia:    res.data.desparasitacionAlDia   ?? false,
          anamnesis:               res.data.anamnesis              ?? '',
          examenFisico:            res.data.examenFisico           ?? '',
          observaciones:           res.data.observaciones          ?? '',
          antecedentesEnfermedades:    res.data.antecedentesEnfermedades    ?? '',
          antecedentesProcedimientos:  res.data.antecedentesProcedimientos  ?? '',
          antecedentesPersonales:      res.data.antecedentesPersonales      ?? '',
          antecedentesFamiliares:      res.data.antecedentesFamiliares      ?? '',
          grupoSanguineo:              res.data.grupoSanguineo              ?? '',
          indicacionesReceta:          res.data.indicacionesReceta          ?? '',
          version:                     res.data.version,
        });
        if (this.isCerrada()) this.form.disable();
        this.loadingStore.hide();
      },
      error: () => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la consulta' });
        this.loadingStore.hide();
      }
    });
  }

  loadHistoria(mascotaId: number) {
    this.hcService.getPorMascota(mascotaId).subscribe({
      next: (res) => this.historia.set(res.data)
    });
  }

  loadRecetas() {
    this.hcService.listarRecetas(this.consultaId).subscribe({
      next: (res) => this.recetas.set(res.data ?? [])
    });
  }

  abrirNuevaReceta() {
    this.recetaEditando.set(null);
    this.recetaForm.reset({ fechaInicio: new Date().toISOString().split('T')[0] });
    this.showRecetaModal.set(true);
  }

  abrirEditarReceta(receta: PrescripcionResponse) {
    this.recetaEditando.set(receta);
    this.recetaForm.patchValue({
      medicamento:       receta.medicamento,
      principioActivo:   receta.principioActivo ?? '',
      dosis:             receta.dosis,
      frecuencia:        receta.frecuencia,
      duracionDias:      receta.duracionDias ?? null,
      viaAdministracion: receta.viaAdministracion,
      instrucciones:     receta.instrucciones ?? '',
      fechaInicio:       receta.fechaInicio,
      fechaFin:          receta.fechaFin ?? '',
    });
    this.showRecetaModal.set(true);
  }

  guardarReceta() {
    if (this.recetaForm.invalid) {
      this.recetaForm.markAllAsTouched();
      return;
    }
    const payload: PrescripcionRequest = { ...this.recetaForm.value };
    if (!payload.fechaFin) delete payload.fechaFin;
    if (!payload.principioActivo) delete payload.principioActivo;
    if (!payload.instrucciones) delete payload.instrucciones;

    const editando = this.recetaEditando();
    const obs$ = editando
      ? this.hcService.actualizarReceta(editando.id, payload)
      : this.hcService.crearReceta(this.consultaId, payload);

    obs$.subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Receta', detail: editando ? 'Receta actualizada' : 'Receta registrada' });
        this.showRecetaModal.set(false);
        this.loadRecetas();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar la receta' });
      }
    });
  }

  confirmarEliminarReceta(receta: PrescripcionResponse) {
    this.recetaEliminando.set(receta);
    this.showConfirmEliminar.set(true);
  }

  eliminarReceta() {
    const receta = this.recetaEliminando();
    if (!receta) return;
    this.hcService.eliminarReceta(receta.id).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Receta', detail: 'Receta eliminada' });
        this.showConfirmEliminar.set(false);
        this.recetaEliminando.set(null);
        this.loadRecetas();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar la receta' });
      }
    });
  }

  imprimirRecetas() {
    const consulta = this.consulta();
    const recetas = this.recetas();
    if (!consulta || recetas.length === 0) return;
    const indicacionesGenerales = this.form.get('indicacionesReceta')?.value || consulta.indicacionesReceta || '';

    const hoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const vetNombre = recetas[0].veterinarioNombre ?? consulta.veterinarioNombre ?? 'Médico Veterinario';

    const medicamentosHtml = recetas.map((r, i) => `
      <div class="rx-box">
        <div class="rx-num">${i + 1}.</div>
        <div class="rx-med">℞ &nbsp;${r.medicamento}${r.principioActivo ? ' <span style="font-size:12px;color:#64748b;font-weight:normal;">(' + r.principioActivo + ')</span>' : ''}</div>
        <div class="rx-detail">
          <div class="item"><label>Dosis</label><p>${r.dosis}</p></div>
          <div class="item"><label>Frecuencia</label><p>${r.frecuencia}</p></div>
          <div class="item"><label>Duración</label><p>${r.duracionDias ? r.duracionDias + ' días' : '—'}</p></div>
          <div class="item"><label>Vía</label><p>${r.viaAdministracion}</p></div>
        </div>
        ${r.instrucciones ? '<div class="indicaciones"><strong>Indicaciones:</strong> ' + r.instrucciones + '</div>' : ''}
      </div>
    `).join('');

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
    .rx-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; position: relative; }
    .rx-num { font-size: 10px; color: #94a3b8; font-weight: bold; margin-bottom: 4px; }
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
      <p>HC: <strong>${consulta.numeroHc ?? '—'}</strong></p>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Datos del paciente</div>
    <div class="grid-2">
      <div class="field"><label>Paciente</label><p>${consulta.mascotaNombre ?? '—'}</p></div>
      <div class="field"><label>Especie / Raza</label><p>${consulta.especie ?? '—'} · ${consulta.raza ?? '—'}</p></div>
      <div class="field"><label>Propietario</label><p>${consulta.apoderadoNombre ?? '—'}</p></div>
      <div class="field"><label>Teléfono</label><p>${consulta.apoderadoTelefono ?? '—'}</p></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Medicamentos prescritos (${recetas.length})</div>
    ${medicamentosHtml}
  </div>
  ${indicacionesGenerales ? `<div class="section"><div class="section-title">Indicaciones generales</div><div style="background:#f8fafc;border-radius:6px;padding:12px;font-size:12px;color:#334155;line-height:1.6;">${indicacionesGenerales}</div></div>` : ''}
  <div class="firma">
    <div class="line"></div><br>
    <p><strong>${vetNombre}</strong></p>
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

  confirmarGuardar() {
    this.confirmSvc.confirm({
      message: '¿Deseas guardar los cambios realizados en la consulta?',
      header: 'Guardar cambios',
      icon: 'pi pi-save',
      acceptLabel: 'Sí, guardar',
      rejectLabel: 'No',
      accept: () => this.guardar()
    });
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const version = this.consulta()?.version;
    if (version === undefined) return;

    this.loadingStore.show();
    const payload = { ...this.form.value, version: this.consulta()?.version };
    this.hcService.updateConsulta(this.consultaId, payload).subscribe({
      next: (res) => {
        this.consulta.set(res.data);
        this.msgService.add({ severity: 'success', summary: 'Guardado', detail: 'Consulta actualizada correctamente' });
        this.loadingStore.hide();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  confirmarCerrar() {
    this.confirmSvc.confirm({
      message: 'Al cerrar la consulta no podrás modificarla. ¿Deseas continuar?',
      header: 'Cerrar consulta',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cerrar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { style: 'background-color: #0066aa; color: white; border: none; font-weight: bold; padding: 0.5rem 1rem; border-radius: 0.375rem;' },
      rejectButtonStyleClass: 'bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold',
      accept: () => this.cerrar()
    });
  }

  private cerrar() {
    const version = this.consulta()?.version;
    if (version === undefined) return;

    this.loadingStore.show();
    this.hcService.cerrarConsulta(this.consultaId, { version }).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Cerrada', detail: 'La consulta fue cerrada exitosamente' });
        setTimeout(() => this.router.navigate(['/citas/agenda']), 1500);
        this.loadingStore.hide();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al cerrar la consulta' });
        this.loadingStore.hide();
      }
    });
  }

  verConsulta(id: number) {
    const item = this.historia()?.consultas.find((c: any) => c.id === id);
    if (item) {
      this.detalleSeleccionado.set(item);
      this.displayDetalleHistorial.set(true);
    }
  }

  volver() {
    this.router.navigate(['/citas/agenda']);
  }

  formatFecha(fecha: string | undefined): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatFechaHora(fecha: string | undefined): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  edadTexto(meses: number | undefined): string {
    if (!meses) return '—';
    if (meses >= 12) {
      const años = Math.floor(meses / 12);
      return `${años} año${años > 1 ? 's' : ''}`;
    }
    return `${meses} mes${meses > 1 ? 'es' : ''}`;
  }
}
