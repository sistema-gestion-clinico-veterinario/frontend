import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { MascotaService } from '../../../core/services/mascota.service';
import { ApoderadoService } from '../../../core/services/apoderado.service';
import { MediaService } from '../../../core/services/media.service';
import { RazaService } from '../../../core/services/raza.service';
import { MascotaResponse } from '../../../models/response/mascota-response';
import { MascotaRequest } from '../../../models/request/mascota-request';
import { RazaRequest } from '../../../models/request/raza-request';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import { InputFilterDirective } from '../../../core/directives/input-filter.directive';
import { noLeadingTrailingSpaceValidator } from '../../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../../core/validators/text-content.validator';
import { normalizeText } from '../../../core/utils/normalize-text.util';

@Component({
  selector: 'app-mascota-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    ToastModule,
    DialogModule,
    InputFilterDirective
  ],
  providers: [MessageService],
  templateUrl: './mascota-form.component.html',
  styleUrl: './mascota-form.component.scss'
})
export class MascotaFormComponent implements OnInit, OnDestroy {
  private readonly fb               = inject(FormBuilder);
  private readonly mascotaService   = inject(MascotaService);
  private readonly apoderadoService = inject(ApoderadoService);
  private readonly razaService      = inject(RazaService);
  readonly mediaService     = inject(MediaService);
  private readonly messageService   = inject(MessageService);
  private readonly router           = inject(Router);
  private readonly route            = inject(ActivatedRoute);
  readonly authStore                = inject(AuthStore);
  readonly loadingStore             = inject(LoadingStore);

  readonly todayStr = new Date().toISOString().split('T')[0];
  readonly minBirthDateBySpecies: Record<string, string> = {
    PERRO: this.dateYearsAgo(20),
    GATO: this.dateYearsAgo(20),
    AVE: this.dateYearsAgo(80),
    REPTIL: this.dateYearsAgo(100),
    ROEDOR: this.dateYearsAgo(15),
    OTRO: this.dateYearsAgo(100)
  };

  isEdit     = signal<boolean>(false);
  editingId  = signal<number | null>(null);
  returnPage = 0;
  returnUrl: string | null = null;
  apoderados = signal<{ label: string; value: number }[]>([]);
  razas      = signal<{ label: string; value: number }[]>([]);
  razaFilterText    = signal<string>('');
  razaDropdownOpen  = signal<boolean>(false);
  displayRazaModal    = signal<boolean>(false);
  savingRaza          = signal<boolean>(false);
  showNuevoCliente = signal<boolean>(false);
  savingCliente    = signal<boolean>(false);
  ncNombre    = signal('');
  ncApellido  = signal('');
  ncTipoDoc   = signal('DNI');
  ncNumDoc    = signal('');
  ncTelefono  = signal('');
  ncCorreo    = signal('');
  ncGenero    = signal('MASCULINO');
  ncDireccion = signal('');
  ncReferencias = signal('');
  previewUrl          = signal<string | null>(null);
  photoError          = signal(false);
  selectedFile        = signal<File | null>(null);
  uploadingPhoto      = signal<boolean>(false);
  isDragging          = signal<boolean>(false);
  zoomModalOpen       = signal<boolean>(false);

  readonly especieOpciones = [
    { label: 'Perro',  value: 'PERRO'  },
    { label: 'Gato',   value: 'GATO'   },
    { label: 'Roedor', value: 'ROEDOR' },
    { label: 'Ave',    value: 'AVE'    },
    { label: 'Reptil', value: 'REPTIL' },
    { label: 'Otro',   value: 'OTRO'   },
  ];

  readonly sexoOpciones = [
    { label: 'Macho',   value: 'MACHO'   },
    { label: 'Hembra',  value: 'HEMBRA'  },
  ];

  readonly tipoDocOpciones = [
    { label: 'DNI',              value: 'DNI' },
    { label: 'Carnet Extranjería', value: 'CARNET_EXTRANJERIA' },
    { label: 'Pasaporte',        value: 'PASAPORTE' },
  ];

  readonly generoOpciones = [
    { label: 'Masculino', value: 'MASCULINO' },
    { label: 'Femenino',  value: 'FEMENINO' },
  ];

  mascotaForm: FormGroup = this.fb.group({
    nombre:          ['',   [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    especie:         [null, [Validators.required]],
    razaId:          [null, [Validators.required]],
    sexo:            [null, [Validators.required]],
    fechaNacimiento: ['',   [Validators.required, (control: AbstractControl) => this.fechaNacimientoValidator(control)]],
    color:           ['', [Validators.maxLength(50), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    peso:            [null, [Validators.min(0.01), Validators.max(120)]],
    fotoUrl:         ['', [Validators.maxLength(500), Validators.pattern(/^$|^https?:\/\/[^\s<>]+$/)]],
    apoderadoId:     [null, [Validators.required]],
  });

  razaForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    descripcion: ['', [Validators.maxLength(300), noLeadingTrailingSpaceValidator(), textContentValidator()]],
  });



  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  ngOnInit() {
    const requestedReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = requestedReturnUrl?.startsWith('/') && !requestedReturnUrl.startsWith('//')
      ? requestedReturnUrl : null;
    const page = Number(this.route.snapshot.queryParamMap.get('returnPage'));
    this.returnPage = Number.isInteger(page) && page > 0 ? page : 0;

    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.isEdit.set(true);
      this.loadApoderados();
      this.loadRazas();
      const state = this.router.getCurrentNavigation()?.extras.state as MascotaResponse | undefined;
      if (state) {
        this.editingId.set(state.id);
        this.patchForm(state);
      } else {
        this.mascotaService.obtenerPorUuid(uuid).subscribe({
          next: (res) => {
            this.editingId.set(res.data.id);
            this.patchForm(res.data);
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la mascota' });
            this.goBack();
          }
        });
      }
    } else {
      this.loadApoderados();
      this.loadRazas();
    }
    this.mascotaForm.get('especie')?.valueChanges.subscribe(() => {
      this.actualizarValidadoresPeso();
      this.mascotaForm.get('fechaNacimiento')?.updateValueAndValidity({ emitEvent: false });
      this.loadRazas();
      this.razaFilterText.set('');
      this.mascotaForm.get('razaId')?.setValue(null);
    });
  }

  private patchForm(m: MascotaResponse) {
    this.mascotaForm.patchValue({
      nombre:          m.nombreCompleto,
      especie:         m.especie,
      razaId:          m.razaId,
      sexo:            m.sexo,
      fechaNacimiento: m.fechaNacimiento,
      color:           m.color ?? '',
      peso:            m.peso ?? null,
      fotoUrl:         m.fotoUrl ?? '',
      apoderadoId:     m.apoderadoId,
    });
    if (m.razaNombre) this.razaFilterText.set(m.razaNombre);
    this.photoError.set(false);
    this.previewUrl.set(this.mediaService.resolveUrl(m.fotoUrl));
  }

  goBack() {
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }
    this.router.navigate(['/mascotas'], {
      queryParams: { page: this.returnPage > 0 ? this.returnPage : null }
    });
  }

  private dateYearsAgo(years: number): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  fechaNacimientoValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    if (value > this.todayStr) return { fechaFutura: true };

    const especie = this.mascotaForm?.get('especie')?.value;
    const minDate = this.minBirthDateBySpecies[especie];
    if (minDate && value < minDate) {
      return { edadMaxima: { especie, minDate } };
    }

    return null;
  }

  fieldError(controlName: string): string {
    const control = this.mascotaForm.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    if (control.errors['pattern']) return 'Ingrese solo caracteres válidos para este campo.';
    if (control.errors['leadingTrailingSpace']) return 'No debe tener espacios al inicio o al final.';
    if (control.errors['fechaFutura']) return 'La fecha no puede ser futura.';
    if (control.errors['edadMaxima']) return this.birthDateErrorMessage(control.errors['edadMaxima'].especie);
    if (control.errors['min']) return `Valor mínimo: ${control.errors['min'].min}.`;
    if (control.errors['max']) return `Valor máximo: ${control.errors['max'].max}.`;

    return 'Valor inválido.';
  }

  razaFieldError(controlName: string): string {
    const control = this.razaForm.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    if (control.errors['pattern']) return 'Ingrese solo letras y espacios; no use números ni símbolos.';
    if (control.errors['leadingTrailingSpace']) return 'No debe tener espacios al inicio o al final.';
    if (control.errors['textContent']) return 'Debe contener texto real.';

    return 'Valor inválido.';
  }

  private birthDateErrorMessage(especie: string): string {
    const maxYears: Record<string, number> = {
      PERRO: 20,
      GATO: 20,
      AVE: 80,
      REPTIL: 100,
      ROEDOR: 15,
      OTRO: 100
    };
    const years = maxYears[especie] ?? 100;
    return `La edad no debe superar ${years} años para esta especie.`;
  }

  private actualizarValidadoresPeso() {
    const pesoCtrl = this.mascotaForm.get('peso');
    const especie = this.mascotaForm.get('especie')?.value;
    const rangos: Record<string, { min: number; max: number }> = {
      PERRO: { min: 3, max: 120 },
      GATO: { min: 0.3, max: 20 },
      AVE: { min: 0.02, max: 5 },
      REPTIL: { min: 0.01, max: 100 },
      ROEDOR: { min: 0.02, max: 10 },
      EXOTICO: { min: 0.01, max: 120 },
      OTRO: { min: 0.01, max: 120 }
    };
    const rango = rangos[especie] ?? rangos['OTRO'];
    pesoCtrl?.setValidators([Validators.min(rango.min), Validators.max(rango.max)]);
    pesoCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  get razasFiltradas() {
    const filtro = this.razaFilterText().toLowerCase();
    return this.razas().filter(r => r.label.toLowerCase().includes(filtro));
  }

  get selectedRazaLabel(): string {
    const id = this.mascotaForm.get('razaId')?.value;
    if (!id) return '';
    const found = this.razas().find(r => r.value === id);
    return found ? found.label : '';
  }

  onRazaInputBlur() {
    setTimeout(() => this.razaDropdownOpen.set(false), 250);
  }

  selectRaza(value: number) {
    this.mascotaForm.get('razaId')?.setValue(value);
    const found = this.razas().find(r => r.value === value);
    this.razaFilterText.set(found ? found.label : '');
    this.razaDropdownOpen.set(false);
  }

  readonly maxFileSize = 5 * 1024 * 1024; // 5 MB

  readonly allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  readonly allowedExtensions = ['.jpg', '.jpeg', '.jpe', '.png', '.webp', '.gif'];

  private isValidFileType(file: File): boolean {
    return this.allowedTypes.includes(file.type) ||
           this.allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!this.isValidFileType(file)) {
      this.messageService.add({ severity: 'warn', summary: 'Formato no permitido', detail: 'Solo se permiten archivos JPG, PNG, WEBP o GIF' });
      input.value = '';
      return;
    }

    if (file.size > this.maxFileSize) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo muy grande', detail: 'El tamaño máximo permitido es 5 MB' });
      input.value = '';
      return;
    }

    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
    this.photoError.set(false);
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    if (!this.isValidFileType(file)) {
      this.messageService.add({ severity: 'warn', summary: 'Formato no permitido', detail: 'Solo se permiten archivos JPG, PNG, WEBP o GIF' });
      return;
    }

    if (file.size > this.maxFileSize) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo muy grande', detail: 'El tamaño máximo permitido es 5 MB' });
      return;
    }

    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
    this.photoError.set(false);
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  onPhotoError() {
    this.photoError.set(true);
    this.previewUrl.set(null);
  }

  removePhoto() {
    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
    this.selectedFile.set(null);
    this.mascotaForm.patchValue({ fotoUrl: '' });
    this.previewUrl.set(null);
  }

  openZoomModal() {
    if (this.previewUrl()) {
      this.zoomModalOpen.set(true);
    }
  }

  closeZoomModal() {
    this.zoomModalOpen.set(false);
  }

  ngOnDestroy() {
    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
  }

  loadRazas() {
    const especie = this.mascotaForm.get('especie')?.value;
    this.razaService.listarPorEspecie(especie || undefined, this.activeCompanyId ?? undefined).subscribe({
      next: (res) => {
        this.razas.set(res.data.map(r => ({ label: r.nombre, value: r.id })));
      }
    });
  }

  openRazaModal() {
    this.razaForm.reset({ nombre: '', descripcion: '' });
    this.displayRazaModal.set(true);
  }

  saveRaza() {
    if (this.razaForm.invalid) {
      this.razaForm.markAllAsTouched();
      return;
    }
    const especie = this.mascotaForm.get('especie')?.value;
    if (!especie) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Primero seleccione una especie' });
      return;
    }
    const request: RazaRequest = {
      nombre: normalizeText(this.razaForm.value.nombre),
      descripcion: normalizeText(this.razaForm.value.descripcion) || undefined,
      especie
    };
    this.savingRaza.set(true);
    this.razaService.crear(request, this.activeCompanyId!).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Raza creada correctamente' });
        this.displayRazaModal.set(false);
        const nuevaRaza = { label: res.data.nombre, value: res.data.id };
        this.razas.update(list => [nuevaRaza, ...list.filter(r => r.value !== nuevaRaza.value)]);
        this.mascotaForm.get('razaId')?.setValue(nuevaRaza.value);
        this.mascotaForm.get('razaId')?.markAsTouched();
        this.razaFilterText.set(nuevaRaza.label);
        this.razaDropdownOpen.set(false);
        this.savingRaza.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al crear la raza' });
        this.savingRaza.set(false);
      }
    });
  }

  onDocInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const tipo = this.ncTipoDoc();
    const raw = input.value;
    let filtered = '';
    if (tipo === 'DNI' || tipo === 'CARNET_EXTRANJERIA') {
      filtered = raw.replace(/\D/g, '');
    } else if (tipo === 'PASAPORTE') {
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (i === 0 && /[A-Za-z]/.test(ch)) {
          filtered += ch.toUpperCase();
        } else if (i > 0 && /\d/.test(ch)) {
          filtered += ch;
        }
      }
    }
    if (filtered !== raw) {
      input.value = filtered;
      this.ncNumDoc.set(filtered);
    }
  }

  toggleNuevoCliente() {
    this.showNuevoCliente.update(v => !v);
    if (this.showNuevoCliente()) {
      this.ncNombre.set(''); this.ncApellido.set(''); this.ncTipoDoc.set('DNI');
      this.ncNumDoc.set(''); this.ncTelefono.set(''); this.ncCorreo.set('');
      this.ncGenero.set('MASCULINO'); this.ncDireccion.set(''); this.ncReferencias.set('');
    }
  }

  crearCliente() {
    const nombre   = normalizeText(this.ncNombre());
    const apellido = normalizeText(this.ncApellido());
    const telefono = this.ncTelefono().trim();
    const correo   = this.ncCorreo().trim();
    const numDoc   = this.ncNumDoc().trim();
    const direccion = normalizeText(this.ncDireccion());
    const referencias = normalizeText(this.ncReferencias());
    const textoSeguro = /^(?=.*\p{L})(?!.*[{}\[\]<>*|\\^~`=@])(?!(?:[\p{P}\p{S}\s]+)$).*$/u;

    if (!nombre || !apellido || !telefono || !correo || !numDoc || !direccion) {
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Complete todos los campos obligatorios.' });
      return;
    }
    if (nombre.length > 80 || apellido.length > 80 || direccion.length > 200 || referencias.length > 500) {
      this.messageService.add({ severity: 'warn', summary: 'Limite excedido', detail: 'Revise la cantidad maxima de caracteres permitidos.' });
      return;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(nombre) || !/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(apellido)) {
      this.messageService.add({ severity: 'warn', summary: 'Nombre inválido', detail: 'Nombres y apellidos solo aceptan letras y espacios.' });
      return;
    }
    if (!/^[0-9]{9}$/.test(telefono)) {
      this.messageService.add({ severity: 'warn', summary: 'Teléfono inválido', detail: 'Debe tener 9 dígitos.' });
      return;
    }
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(correo)) {
      this.messageService.add({ severity: 'warn', summary: 'Correo inválido', detail: 'Use un correo válido en minúsculas.' });
      return;
    }

    if (!textoSeguro.test(direccion) || (referencias && !textoSeguro.test(referencias))) {
      this.messageService.add({ severity: 'warn', summary: 'Texto invalido', detail: 'No use caracteres como }, *, <, > ni campos solo con puntos.' });
      return;
    }

    const documentoValido = this.ncTipoDoc() === 'DNI'
      ? /^\d{8}$/.test(numDoc)
      : this.ncTipoDoc() === 'PASAPORTE'
        ? /^[a-zA-Z]\d{8}$/.test(numDoc)
        : /^\d{9}$/.test(numDoc);
    if (!documentoValido) {
      this.messageService.add({ severity: 'warn', summary: 'Documento inválido', detail: 'Verifique el formato del documento.' });
      return;
    }

    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No hay empresa seleccionada' });
      return;
    }

    this.savingCliente.set(true);
    this.apoderadoService.registrar({
      nombre,
      apellido,
      tipoDocumento: this.ncTipoDoc(),
      numeroDocumento: numDoc,
      telefono,
      email: correo,
      genero: this.ncGenero(),
      direccion,
      referencias: referencias || undefined,
      companyId
    }).subscribe({
      next: (res) => {
        const apoderadoId = res.data.apoderadoId ?? res.data.id;
        const nuevo = { label: `${nombre} ${apellido}`, value: apoderadoId };
        this.apoderados.update(list => [nuevo, ...list]);
        this.mascotaForm.patchValue({ apoderadoId });
        this.showNuevoCliente.set(false);
        this.savingCliente.set(false);
        this.messageService.add({ severity: 'success', summary: 'Cliente creado', detail: `${nombre} ${apellido} registrado correctamente.` });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear el cliente.' });
        this.savingCliente.set(false);
      }
    });
  }

  loadApoderados() {
    const companyId = this.activeCompanyId;
    if (!companyId) {
      this.apoderados.set([]);
      return;
    }
    this.apoderadoService.listar(companyId, undefined, undefined, 0, 200).subscribe({
      next: (res) => {
        this.apoderados.set(
          res.data.content.map(c => ({
            label: `${c.nombre} ${c.apellido}`,
            value: c.id
          }))
        );
      }
    });
  }

  saveMascota() {
    if (this.mascotaForm.invalid) {
      this.mascotaForm.markAllAsTouched();
      return;
    }

    const doSave = (fotoUrl?: string) => {
      const v = this.mascotaForm.value;
      const request: MascotaRequest = {
        nombreCompleto:  normalizeText(v.nombre),
        especie:         v.especie,
        razaId:          v.razaId,
        sexo:            v.sexo,
        fechaNacimiento: v.fechaNacimiento,
        color:           normalizeText(v.color) || undefined,
        peso:            v.peso ?? undefined,
        fotoUrl:         fotoUrl || v.fotoUrl || undefined,
        apoderadoId:     v.apoderadoId,
      };

      this.loadingStore.show();
      const obs = this.isEdit()
        ? this.mascotaService.actualizar(this.editingId()!, request)
        : this.mascotaService.crear(request);

      obs.subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Listo',
            detail: this.isEdit() ? 'Mascota actualizada correctamente' : 'Mascota registrada correctamente'
          });
          this.loadingStore.hide();
          if (this.returnUrl && !this.isEdit()) {
            this.router.navigate([this.returnUrl], { queryParams: { petId: response.data.id } });
            return;
          }
          this.goBack();
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Error al guardar la mascota'
          });
          this.loadingStore.hide();
        }
      });
    };

    const file = this.selectedFile();
    if (file) {
      this.uploadingPhoto.set(true);
      this.mediaService.upload(file).subscribe({
        next: (path) => {
          this.selectedFile.set(null);
          this.uploadingPhoto.set(false);
          doSave(path);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir la imagen' });
          this.uploadingPhoto.set(false);
        }
      });
    } else {
      doSave();
    }
  }

  especieLabel(especie: string): string {
    const m: Record<string, string> = {
      PERRO: 'Perro', GATO: 'Gato', AVE: 'Ave',
      CONEJO: 'Conejo', REPTIL: 'Reptil', OTRO: 'Otro'
    };
    return m[especie?.toUpperCase()] ?? especie;
  }
}

