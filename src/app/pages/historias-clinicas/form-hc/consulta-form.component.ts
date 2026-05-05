import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextarea } from 'primeng/inputtextarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { MessageService, ConfirmationService } from 'primeng/api';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { LoadingStore } from '../../../store/loading.store';
import { ConsultaResponse } from '../../../models/response/consulta-response';

@Component({
  selector: 'app-consulta-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    InputNumberModule,
    InputTextarea,
    ConfirmDialogModule,
    TimelineModule,
    CardModule
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
  historia   = signal<any | null>(null); // Para ver antecedentes y consultas previas
  tabActiva  = signal<'signos' | 'clinico' | 'antecedentes' | 'historial'>('signos');
  isCerrada  = signal<boolean>(false);
  consultaId = 0;

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
    pesoEnConsulta:          [null, Validators.required],
    temperatura:             [null],
    frecuenciaCardiaca:      [null],
    frecuenciaRespiratoria:  [null],
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
        
        // Cargar historia clínica de la mascota
        if (res.data.mascotaId) {
          this.loadHistoria(res.data.mascotaId);
        }

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
    this.router.navigate(['/historias-clinicas/consulta', id]);
  }

  volver() {
    this.router.navigate(['/citas/agenda']);
  }

  formatFecha(fecha: string | undefined): string {
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
