import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
import { EMPTY, Observable, Subscription, catchError, concatMap, debounceTime, filter, finalize, map, of, switchMap, tap } from 'rxjs';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { ConsultaResponse } from '../../../models/response/consulta-response';
import { PrescripcionResponse } from '../../../models/response/prescripcion-response';
import { PrescripcionRequest } from '../../../models/request/prescripcion-request';
import { ArchivoClinicoResponse } from '../../../models/response/archivo-clinico-response';
import { RecetaModalsComponent } from '../form-hc/receta-modals/receta-modals.component';
import { ArchivoModalsComponent } from '../form-hc/archivo-modals/archivo-modals.component';
import { Role } from '../../../core/enums/role.enum';


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
    BadgeModule,
    RecetaModalsComponent,
    ArchivoModalsComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './consulta-form.component.html'
})
export class ConsultaFormComponent implements OnInit, OnDestroy {
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly fb          = inject(FormBuilder);
  private readonly hcService   = inject(HistoriaClinicaService);
  private readonly msgService  = inject(MessageService);
  private readonly confirmSvc  = inject(ConfirmationService);
  private readonly sanitizer   = inject(DomSanitizer);
  readonly loadingStore        = inject(LoadingStore);
  readonly authStore          = inject(AuthStore);
  returnUrl = '/citas/agenda';

  readonly canCreate = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'escribir'));
  readonly canModify = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'modificar'));
  readonly canDelete = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'eliminar'));
  readonly isAdminOrSuper = computed(() => this.authStore.roles().includes(Role.ADMIN) || this.authStore.roles().includes(Role.SUPER_ADMIN));
  readonly canCreateReceta = computed(() => this.canCreate() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canModifyReceta = computed(() => this.canModify() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canDeleteReceta = computed(() => this.canDelete() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canCreateArchivo = computed(() => this.canCreate() && (!this.isCerrada() || this.isAdminOrSuper()));
  readonly canDeleteArchivo = computed(() => this.canDelete() && (!this.isCerrada() || this.isAdminOrSuper()));

  consulta   = signal<ConsultaResponse | null>(null);
  historia   = signal<any | null>(null); 
  tabActiva  = signal<'signos' | 'clinico' | 'antecedentes' | 'historial' | 'recetas' | 'examenes'>('signos');
  isCerrada  = signal<boolean>(false);
  autoSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error' | 'invalid'>('idle');
  consultaId = 0;
  displayDetalleHistorial = signal<boolean>(false);
  detalleSeleccionado      = signal<any | null>(null);

  archivos           = signal<ArchivoClinicoResponse[]>([]);
  archivoSubiendo    = signal<boolean>(false);
  archivoPendiente   = signal<File | null>(null);
  archivoPreviewUrl  = signal<string | null>(null);
  tipoSeleccionado   = signal<string>('LABORATORIO');
  descripcionArchivo = signal<string>('');
  archivoEliminando  = signal<ArchivoClinicoResponse | null>(null);
  showConfirmEliminarArchivo = signal<boolean>(false);
  previewArchivo     = signal<ArchivoClinicoResponse | null>(null);
  previewUrl         = signal<SafeResourceUrl | string>('');
  previewRawUrl      = signal<string>('');
  previewTipo        = signal<'imagen' | 'pdf' | 'dcm' | 'docx' | null>(null);

  readonly tiposArchivo = [
    { label: 'Laboratorio',  value: 'LABORATORIO' },
    { label: 'Radiografía',  value: 'RADIOGRAFIA' },
    { label: 'Ecografía',    value: 'ECOGRAFIA'   },
    { label: 'Imagen',       value: 'IMAGEN'      },
    { label: 'Documento',    value: 'DOCUMENTO'   },
    { label: 'Otro',         value: 'OTRO'        },
  ];

  recetas            = signal<PrescripcionResponse[]>([]);
  showRecetaModal    = signal<boolean>(false);
  recetaEditando     = signal<PrescripcionResponse | null>(null);
  recetaEliminando   = signal<PrescripcionResponse | null>(null);
  showConfirmEliminar = signal<boolean>(false);
  private autosaveSub?: Subscription;
  private syncingForm = false;

  recetaForm: FormGroup = this.fb.group({
    medicamento:       ['', [Validators.required, Validators.maxLength(80)]],
    principioActivo:   ['', [Validators.maxLength(80)]],
    dosis:             ['', [Validators.required, Validators.maxLength(80)]],
    frecuencia:        ['', [Validators.required, Validators.maxLength(80)]],
    duracionDias:      [null, [Validators.min(1), Validators.max(365)]],
    viaAdministracion: ['', [Validators.required, Validators.maxLength(50)]],
    instrucciones:     ['', [Validators.maxLength(500)]],
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
    pesoEnConsulta:          [null, [Validators.required, Validators.min(0.01), Validators.max(120)]],
    temperatura:             [null, [Validators.min(0.1), Validators.max(45)]],
    frecuenciaCardiaca:      [null, [Validators.min(1), Validators.max(300)]],
    frecuenciaRespiratoria:  [null, [Validators.min(1), Validators.max(200)]],
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
    this.setupAutosave();
    this.route.queryParamMap.subscribe(params => {
      if (params.get('returnUrl')) {
        this.returnUrl = params.get('returnUrl')!;
      }
      if (params.get('tab') === 'recetas') {
        this.tabActiva.set('recetas');
      }
    });
    this.route.params.subscribe(params => {
      this.consultaId = Number(params['consultaId']);
      if (!this.consultaId) {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'ID de consulta no válido' });
        this.router.navigateByUrl(this.returnUrl);
        return;
      }
      this.loadConsulta();
    });
  }

  ngOnDestroy() {
    this.autosaveSub?.unsubscribe();
    if (this.archivoPreviewUrl()) URL.revokeObjectURL(this.archivoPreviewUrl()!);
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
        this.loadArchivos();

        this.syncingForm = true;
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
        }, { emitEvent: false });
        if (this.puedeEditarConsulta()) {
          this.form.enable({ emitEvent: false });
        } else {
          this.form.disable({ emitEvent: false });
        }
        this.form.markAsPristine();
        this.autoSaveStatus.set('saved');
        this.syncingForm = false;
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

  private setupAutosave() {
    this.autosaveSub = this.form.valueChanges.pipe(
      debounceTime(1200),
      tap(() => {
        if (!this.syncingForm && this.puedeEditarConsulta() && this.form.dirty && this.form.invalid) {
          this.form.markAllAsTouched();
          this.autoSaveStatus.set('invalid');
        }
      }),
      filter(() => !this.syncingForm && this.puedeEditarConsulta() && this.form.dirty && this.form.valid),
      concatMap(() => this.guardarSilencioso(false))
    ).subscribe();
  }

  private puedeEditarConsulta(): boolean {
    return this.canModify();
  }

  loadRecetas() {
    this.hcService.listarRecetas(this.consultaId).subscribe({
      next: (res) => this.recetas.set(res.data ?? [])
    });
  }

  loadArchivos() {
    this.hcService.listarArchivos(this.consultaId).subscribe({
      next: (res) => this.archivos.set(res.data ?? [])
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.archivoPreviewUrl()) {
      URL.revokeObjectURL(this.archivoPreviewUrl()!);
    }
    this.archivoPendiente.set(file);
    this.archivoPreviewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  subirArchivo() {
    if (!this.canCreateArchivo()) return;
    const file = this.archivoPendiente();
    if (!file) return;
    this.archivoSubiendo.set(true);
    this.hcService.subirArchivo(this.consultaId, file, this.tipoSeleccionado(), this.descripcionArchivo() || undefined).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Examen', detail: 'Archivo subido correctamente' });
        if (this.archivoPreviewUrl()) URL.revokeObjectURL(this.archivoPreviewUrl()!);
        this.archivoPreviewUrl.set(null);
        this.archivoPendiente.set(null);
        this.descripcionArchivo.set('');
        this.archivoSubiendo.set(false);
        this.loadArchivos();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo subir el archivo' });
        this.archivoSubiendo.set(false);
      }
    });
  }

  visualizarArchivo(archivo: ArchivoClinicoResponse) {
    const ext = archivo.nombre?.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'dcm') {
      this.previewArchivo.set(archivo);
      this.previewTipo.set('dcm');
      this.previewUrl.set('');
      return;
    }
    if (ext === 'docx' || ext === 'doc') {
      this.previewArchivo.set(archivo);
      this.previewTipo.set('docx');
      this.previewUrl.set('');
      return;
    }
    this.hcService.obtenerContenidoArchivo(this.consultaId, archivo.id).subscribe({
      next: (blob) => {
        if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
        const mime = archivo.tipoMime || blob.type || 'application/octet-stream';
        const typedBlob = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mime });
        const objectUrl = URL.createObjectURL(typedBlob);
        this.previewRawUrl.set(objectUrl);
        this.previewUrl.set(ext === 'pdf'
          ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl)
          : objectUrl);
        this.previewArchivo.set(archivo);
        this.previewTipo.set(ext === 'pdf' ? 'pdf' : 'imagen');
      },
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el archivo' })
    });
  }

  cerrarPreview() {
    if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
    this.previewRawUrl.set('');
    this.previewUrl.set('');
    this.previewArchivo.set(null);
    this.previewTipo.set(null);
  }

  descargarArchivo(archivo: ArchivoClinicoResponse) {
    this.hcService.obtenerContenidoArchivo(this.consultaId, archivo.id, true).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = archivo.nombre;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo descargar el archivo' })
    });
  }

  confirmarEliminarArchivo(archivo: ArchivoClinicoResponse) {
    if (!this.canDeleteArchivo()) return;
    this.archivoEliminando.set(archivo);
    this.showConfirmEliminarArchivo.set(true);
  }

  eliminarArchivo() {
    if (!this.canDeleteArchivo()) return;
    const archivo = this.archivoEliminando();
    if (!archivo) return;
    this.hcService.eliminarArchivo(this.consultaId, archivo.id).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Examen', detail: 'Archivo eliminado' });
        this.showConfirmEliminarArchivo.set(false);
        this.archivoEliminando.set(null);
        this.loadArchivos();
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo eliminar el archivo' })
    });
  }

  formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  iconoTipo(tipo: string): string {
    const map: Record<string, string> = {
      LABORATORIO: 'pi-microchip', RADIOGRAFIA: 'pi-eye', ECOGRAFIA: 'pi-wave-pulse',
      IMAGEN: 'pi-image', OTRO: 'pi-file', PDF: 'pi-file-pdf'
    };
    return map[tipo] ?? 'pi-file';
  }

  abrirNuevaReceta() {
    if (!this.canCreateReceta()) return;
    this.recetaEditando.set(null);
    this.recetaForm.reset({ fechaInicio: new Date().toISOString().split('T')[0] });
    this.showRecetaModal.set(true);
  }

  abrirEditarReceta(receta: PrescripcionResponse) {
    if (!this.canModifyReceta()) return;
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
    if (this.recetaEditando() ? !this.canModifyReceta() : !this.canCreateReceta()) return;
    if (this.recetaForm.invalid) {
      this.recetaForm.markAllAsTouched();
      return;
    }
    const payload: PrescripcionRequest = { ...this.recetaForm.value };
    if (payload.fechaFin && payload.fechaInicio && payload.fechaFin < payload.fechaInicio) {
      this.msgService.add({ severity: 'warn', summary: 'Fechas invalidas', detail: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
      return;
    }
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
    if (!this.canDeleteReceta()) return;
    this.recetaEliminando.set(receta);
    this.showConfirmEliminar.set(true);
  }

  eliminarReceta() {
    if (!this.canDeleteReceta()) return;
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

  private guardarSilencioso(mostrarError: boolean): Observable<boolean> {
    if (!this.canModify()) return of(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.autoSaveStatus.set('invalid');
      return of(false);
    }
    const version = this.consulta()?.version;
    if (version === undefined) return of(false);

    this.autoSaveStatus.set('saving');
    const payload = { ...this.form.getRawValue(), version };
    return this.hcService.updateConsulta(this.consultaId, payload, true).pipe(
      tap((res) => {
        this.sincronizarConsultaGuardada(res.data);
      }),
      map(() => true),
      catchError((err) => {
        this.autoSaveStatus.set('error');
        if (mostrarError) {
          this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar automaticamente' });
        }
        return of(false);
      })
    );
  }

  confirmarGuardar() {
    if (!this.canModify()) return;
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
    if (!this.canModify()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const version = this.consulta()?.version;
    if (version === undefined) return;

    this.loadingStore.show();
    const payload = { ...this.form.getRawValue(), version: this.consulta()?.version };
    this.hcService.updateConsulta(this.consultaId, payload).subscribe({
      next: (res) => {
        this.sincronizarConsultaGuardada(res.data);
        this.msgService.add({ severity: 'success', summary: 'Guardado', detail: 'Consulta actualizada correctamente' });
        this.loadingStore.hide();
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.loadingStore.hide();
      }
    });
  }

  reintentarGuardado() {
    if (!this.canModify()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.autoSaveStatus.set('invalid');
      return;
    }
    this.guardarSilencioso(true).subscribe();
  }

  confirmarCerrar() {
    if (!this.canModify()) return;
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
    if (!this.canModify()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingStore.show();
    this.guardarSilencioso(true).pipe(
      switchMap((guardado) => {
        const version = this.consulta()?.version;
        if (!guardado || version === undefined) return EMPTY;
        return this.hcService.cerrarConsulta(this.consultaId, { version });
      }),
      finalize(() => this.loadingStore.hide())
    ).subscribe({
      next: () => {
        this.msgService.add({ severity: 'success', summary: 'Cerrada', detail: 'La consulta fue cerrada exitosamente' });
        setTimeout(() => this.router.navigateByUrl(this.returnUrl), 1500);
      },
      error: (err) => {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al cerrar la consulta' });
      }
    });
  }

  private sincronizarConsultaGuardada(data: ConsultaResponse) {
    this.syncingForm = true;
    this.consulta.set(data);
    this.isCerrada.set(data.estado === 'CERRADA');
    this.form.patchValue({ version: data.version }, { emitEvent: false });
    this.form.markAsPristine();
    this.autoSaveStatus.set('saved');
    this.syncingForm = false;
  }

  verConsulta(id: number) {
    const item = this.historia()?.consultas.find((c: any) => c.id === id);
    if (item) {
      this.detalleSeleccionado.set(item);
      this.displayDetalleHistorial.set(true);
    }
  }

  volver() {
    this.router.navigateByUrl(this.returnUrl);
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
