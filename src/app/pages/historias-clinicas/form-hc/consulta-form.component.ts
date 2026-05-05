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
    ConfirmDialogModule
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
  tabActiva  = signal<'signos' | 'clinico' | 'antecedentes'>('signos');
  isCerrada  = signal<boolean>(false);
  consultaId = 0;

  readonly tiposConsulta = [
    { label: 'Consulta general', value: 'CONSULTA_GENERAL' },
    { label: 'Urgencia',         value: 'URGENCIA'          },
    { label: 'Control',          value: 'CONTROL'           },
    { label: 'Cirugía',          value: 'CIRUGIA'           },
    { label: 'Vacunación',       value: 'VACUNACION'        },
    { label: 'Desparasitación',  value: 'DESPARASITACION'   },
  ];

  form: FormGroup = this.fb.group({
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
    this.consultaId = Number(this.route.snapshot.paramMap.get('consultaId'));
    this.loadConsulta();
  }

  loadConsulta() {
    this.loadingStore.show();
    this.hcService.getConsulta(this.consultaId).subscribe({
      next: (res) => {
        this.consulta.set(res.data);
        this.isCerrada.set(res.data.estado === 'CERRADA');
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

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const version = this.consulta()?.version;
    if (version === undefined) return;

    this.loadingStore.show();
    this.hcService.updateConsulta(this.consultaId, { version, ...this.form.value }).subscribe({
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
