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

  isEdit     = signal<boolean>(false);
  editingId  = signal<number | null>(null);
  returnPage = 0;
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
    fechaNacimiento: ['',   [Validators.required, (control: AbstractControl) => this.fechaNoFuturaValidator(control)]],
    color:           ['', [Validators.maxLength(50), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/)]],
    peso:            [null, [Validators.min(0), Validators.max(150)]],
    fotoUrl:         [''],
    apoderadoId:     [null, [Validators.required]],
  });

  razaForm: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    descripcion: ['', [Validators.maxLength(300)]],
  });



  get activeCompanyId(): number | null {
    return this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId();
  }

  ngOnInit() {
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
    this.router.navigate(['/mascotas'], {
      queryParams: { page: this.returnPage > 0 ? this.returnPage : null }
    });
  }

  fechaNoFuturaValidator(control: AbstractControl): ValidationErrors | null {
    return control.value && control.value > this.todayStr ? { fechaFutura: true } : null;
  }

  private actualizarValidadoresPeso() {
    const pesoCtrl = this.mascotaForm.get('peso');
    const especie = this.mascotaForm.get('especie')?.value;
    const rangos: Record<string, { min: number; max: number }> = {
      PERRO: { min: 0, max: 500 },
      GATO: { min: 0, max: 500 },
      AVE: { min: 0, max: 500 },
      REPTIL: { min: 0, max: 500 },
      ROEDOR: { min: 0, max: 500 },
      EXOTICO: { min: 0, max: 500 },
      OTRO: { min: 0, max: 500 }
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
        this.loadRazas();
        this.mascotaForm.get('razaId')?.setValue(res.data.id);
        this.savingRaza.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al crear la raza' });
        this.savingRaza.set(false);
      }
    });
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

    if (!nombre || !apellido || !telefono || !correo || !numDoc || !direccion) {
      this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Complete todos los campos obligatorios.' });
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.messageService.add({ severity: 'warn', summary: 'Correo inválido', detail: 'Ingrese un correo electrónico válido.' });
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
      referencias: normalizeText(this.ncReferencias()) || undefined,
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
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Listo',
            detail: this.isEdit() ? 'Mascota actualizada correctamente' : 'Mascota registrada correctamente'
          });
          this.loadingStore.hide();
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