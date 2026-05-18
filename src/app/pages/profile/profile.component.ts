import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProfileService } from '../../core/services/profile.service';
import { MediaService } from '../../core/services/media.service';
import { ProfileResponse } from '../../models/response/profile-response';
import { LoadingStore } from '../../store/loading.store';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly mediaService = inject(MediaService);
  private readonly messageService = inject(MessageService);
  readonly loadingStore = inject(LoadingStore);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  profile = signal<ProfileResponse | null>(null);
  editMode = signal(false);
  uploadingPhoto = signal(false);
  previewUrl = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    nombre:      ['', [Validators.required, Validators.minLength(2)]],
    apellido:    ['', [Validators.required, Validators.minLength(2)]],
    telefono:    ['', [Validators.pattern(/^\d{7,15}$/)]],
    direccion:   [''],
    observaciones: [''],
    fotoUrl:     ['']
  });

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.loadingStore.show();
    this.profileService.getProfile().subscribe({
      next: (res) => {
        this.profile.set(res.data);
        this.patchForm(res.data);
        this.loadingStore.hide();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el perfil' });
        this.loadingStore.hide();
      }
    });
  }

  patchForm(p: ProfileResponse) {
    this.form.patchValue({
      nombre:      p.nombre ?? '',
      apellido:    p.apellido ?? '',
      telefono:    p.telefono ?? '',
      direccion:   p.direccion ?? '',
      observaciones: p.observaciones ?? '',
      fotoUrl:     p.fotoUrl ?? ''
    });
    this.previewUrl.set(this.mediaService.resolveUrl(p.fotoUrl));
  }

  toggleEdit() {
    if (this.editMode()) {
      const p = this.profile();
      if (p) this.patchForm(p);
    }
    this.editMode.update(v => !v);
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      this.messageService.add({ severity: 'warn', summary: 'Formato no válido', detail: 'Solo se permiten imágenes JPG, PNG, WEBP o GIF' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo muy grande', detail: 'El tamaño máximo permitido es 5 MB' });
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to server
    this.uploadingPhoto.set(true);
    this.mediaService.upload(file).subscribe({
      next: (url) => {
        this.form.patchValue({ fotoUrl: url });
        this.uploadingPhoto.set(false);
        this.messageService.add({ severity: 'success', summary: 'Foto cargada', detail: 'La foto se subió correctamente. Guarda los cambios para aplicar.' });
      },
      error: () => {
        this.previewUrl.set(this.mediaService.resolveUrl(this.profile()?.fotoUrl));
        this.uploadingPhoto.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir la imagen' });
      }
    });

    // Reset input so same file can be selected again
    input.value = '';
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Campos inválidos', detail: 'Revisa los campos del formulario' });
      return;
    }

    this.loadingStore.show();
    this.profileService.updateProfile(this.form.value).subscribe({
      next: (res) => {
        this.profile.set(res.data);
        this.patchForm(res.data);
        this.editMode.set(false);
        this.messageService.add({ severity: 'success', summary: 'Perfil actualizado', detail: 'Tus datos han sido guardados correctamente' });
        this.loadingStore.hide();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo actualizar el perfil' });
        this.loadingStore.hide();
      }
    });
  }

  get roleLabel(): string {
    const roles = this.profile()?.roles ?? [];
    const map: Record<string, string> = {
      'ROLE_SUPER_ADMIN': 'Super Administrador',
      'ROLE_ADMIN': 'Administrador',
      'ROLE_VETERINARIO': 'Veterinario',
      'ROLE_RECEPCIONISTA': 'Recepcionista',
      'ROLE_CLIENTE': 'Cliente',
      'ROLE_APODERADO': 'Apoderado'
    };
    return roles.map(r => map[r] ?? r).join(', ');
  }

  get userInitials(): string {
    const p = this.profile();
    if (!p) return '?';
    return `${p.nombre?.charAt(0) ?? ''}${p.apellido?.charAt(0) ?? ''}`.toUpperCase();
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }
}
