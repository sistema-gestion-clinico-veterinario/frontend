import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';

import { ApoderadoService } from '../../../core/services/apoderado.service';
import { PrivacidadService } from '../../../core/services/privacidad.service';
import { RazaService } from '../../../core/services/raza.service';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { lowercaseEmailValidator } from '../../../core/validators/lowercase-email.validator';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { AvisoPublico } from '../../../models/privacy/privacidad.model';
import { AuthStore } from '../../../store/auth.store';

@Component({
  selector: 'app-client-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './client-onboarding.component.html',
  styleUrl: './client-onboarding.component.scss'
})
export class ClientOnboardingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly privacidadService = inject(PrivacidadService);
  private readonly razaService = inject(RazaService);
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);

  readonly step = signal<1 | 2 | 3>(1);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly aviso = signal<AvisoPublico | null>(null);
  readonly clientName = signal('');
  readonly clientEmail = signal('');
  readonly petName = signal('');
  readonly breeds = signal<{ label: string; value: number }[]>([]);
  readonly loadingBreeds = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);

  readonly canCreatePet = computed(() => this.authStore.hasAccess('VISTA_MASCOTAS', 'escribir'));

  readonly clientForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    tipoDocumento: ['DNI', Validators.required],
    numeroDocumento: ['', [Validators.required, this.documentValidator.bind(this)]],
    genero: ['MASCULINO', Validators.required],
    email: ['', [Validators.required, Validators.email, lowercaseEmailValidator(), Validators.maxLength(100)]],
    username: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9._-]+$/), noLeadingTrailingSpaceValidator()]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    direccion: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s\.,#\-\/°:]+$/), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    referencias: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    avisoInformado: [false, Validators.requiredTrue],
    consentimientoRecordatorios: [null as boolean | null]
  });

  readonly petForm = this.fb.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    especie: ['', Validators.required],
    otraEspecie: ['', [Validators.maxLength(60), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]*$/)]],
    razaId: [null as number | null, Validators.required],
    sexo: ['', Validators.required],
    fechaNacimiento: ['', [Validators.required, this.notFutureDate]],
    color: ['', [Validators.maxLength(50), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]*$/), noLeadingTrailingSpaceValidator()]],
    peso: [null as number | null, [Validators.min(0.01), Validators.max(120)]]
  });

  ngOnInit(): void {
    this.privacidadService.avisoVigente('PROPIETARIOS_Y_AUTORIZADOS').subscribe({
      next: ({ data }) => this.aviso.set(data ?? null),
      error: () => this.aviso.set(null)
    });
    this.clientForm.controls.tipoDocumento.valueChanges.subscribe(() => {
      this.clientForm.controls.numeroDocumento.setValue('');
      this.clientForm.controls.numeroDocumento.updateValueAndValidity();
    });
    this.petForm.controls.especie.valueChanges.subscribe(especie => {
      this.petForm.controls.razaId.setValue(null);
      const otherSpecies = this.petForm.controls.otraEspecie;
      otherSpecies.setValidators(especie === 'OTRO'
        ? [Validators.required, Validators.maxLength(60), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/)]
        : [Validators.maxLength(60)]);
      if (especie !== 'OTRO') otherSpecies.setValue('');
      otherSpecies.updateValueAndValidity({ emitEvent: false });
      this.loadBreeds(especie ?? '');
    });
  }

  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  submitClient(): void {
    this.errorMessage.set('');
    if (!this.canCreatePet()) {
      this.errorMessage.set('Necesitas permiso para registrar mascotas y completar el alta del cliente.');
      return;
    }
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      this.errorMessage.set('Revisa los campos obligatorios antes de continuar.');
      return;
    }
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.errorMessage.set('Selecciona una empresa antes de registrar al cliente.');
      return;
    }
    const value = this.clientForm.getRawValue();
    this.clientName.set(`${normalizeText(value.nombre)} ${normalizeText(value.apellido)}`.trim());
    this.clientEmail.set(value.email!.trim().toLowerCase());
    this.step.set(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  submitPet(): void {
    this.errorMessage.set('');
    if (this.petForm.invalid) {
      this.petForm.markAllAsTouched();
      this.errorMessage.set('Completa los datos obligatorios de la mascota.');
      return;
    }
    const value = this.petForm.getRawValue();
    const client = this.clientForm.getRawValue();
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.errorMessage.set('Selecciona una empresa antes de completar el registro.');
      return;
    }
    this.saving.set(true);
    this.apoderadoService.registrarConPrimeraMascota({
      nombre: normalizeText(client.nombre),
      apellido: normalizeText(client.apellido),
      tipoDocumento: client.tipoDocumento!,
      numeroDocumento: client.numeroDocumento!.trim().toUpperCase(),
      genero: client.genero!,
      email: client.email!.trim().toLowerCase(),
      username: client.username!.trim().toLowerCase(),
      telefono: client.telefono!.trim(),
      direccion: normalizeText(client.direccion),
      referencias: normalizeText(client.referencias) || undefined,
      companyId,
      avisoInformado: true,
      consentimientoRecordatorios: client.consentimientoRecordatorios
    }, {
        nombreCompleto: normalizeText(value.nombreCompleto),
        especie: value.especie!,
        otraEspecie: normalizeText(value.otraEspecie) || undefined,
        razaId: value.razaId!,
        sexo: value.sexo!,
        fechaNacimiento: value.fechaNacimiento!,
        color: normalizeText(value.color) || undefined,
        peso: value.peso ?? undefined
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ data }) => {
        this.clientName.set(`${data.cliente.nombre} ${data.cliente.apellido}`.trim());
        this.clientEmail.set(data.cliente.email);
        this.petName.set(data.mascota.nombreCompleto);
        this.step.set(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: err => this.errorMessage.set(err?.error?.message ?? 'No se pudo registrar la mascota.')
    });
  }

  goToClients(): void {
    this.router.navigate(['/clientes']);
  }

  backToClient(): void {
    this.errorMessage.set('');
    this.step.set(1);
  }

  startAnother(): void {
    this.router.navigateByUrl('/clientes', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/clientes/nuevo']);
    });
  }

  sanitizeDocument(event: Event): void {
    const input = event.target as HTMLInputElement;
    const type = this.clientForm.controls.tipoDocumento.value;
    let value = input.value.toUpperCase();
    value = type === 'PASAPORTE'
      ? value.replace(/[^A-Z0-9]/g, '').slice(0, 9)
      : value.replace(/\D/g, '').slice(0, type === 'CARNET_EXTRANJERIA' ? 9 : 8);
    this.clientForm.controls.numeroDocumento.setValue(value, { emitEvent: false });
  }

  fieldInvalid(form: 'client' | 'pet', field: string): boolean {
    const control: AbstractControl | null = form === 'client'
      ? this.clientForm.get(field)
      : this.petForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private loadBreeds(especie: string): void {
    if (!especie || !this.activeCompanyId) {
      this.breeds.set([]);
      return;
    }
    this.loadingBreeds.set(true);
    this.razaService.listarPorEspecie(especie, this.activeCompanyId).pipe(
      finalize(() => this.loadingBreeds.set(false))
    ).subscribe({
      next: ({ data }) => this.breeds.set((data ?? []).filter(item => item.activo).map(item => ({ label: item.nombre, value: item.id }))),
      error: () => {
        this.breeds.set([]);
        this.errorMessage.set('No se pudieron cargar las razas disponibles.');
      }
    });
  }

  private documentValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '');
    if (!value) return null;
    const type = this.clientForm?.controls.tipoDocumento?.value ?? 'DNI';
    if (type === 'CARNET_EXTRANJERIA') return /^\d{9}$/.test(value) ? null : { document: true };
    if (type === 'PASAPORTE') return /^[A-Za-z]\d{8}$/.test(value) ? null : { document: true };
    return /^\d{8}$/.test(value) ? null : { document: true };
  }

  private notFutureDate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    return String(control.value) <= new Date().toISOString().slice(0, 10) ? null : { futureDate: true };
  }
}
