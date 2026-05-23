import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProfileService } from '../../core/services/profile.service';
import { MediaService } from '../../core/services/media.service';
import { ProfileResponse } from '../../models/response/profile-response';
import { HorarioEmpleadoResponse } from '../../models/response/horario-empleado-response';
import { LoadingStore } from '../../store/loading.store';

interface HorarioResumen {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  rangoFechas: string;
  totalFechas: number;
}

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

  get horariosResumen(): HorarioResumen[] {
    const horarios = this.profile()?.horarios?.filter(h => h.activo !== false) ?? [];
    return this.buildHorarioResumen(horarios);
  }

  formatDiaSemana(dia: string): string {
    const labels: Record<string, string> = {
      LUNES: 'Lunes',
      MARTES: 'Martes',
      MIERCOLES: 'Miercoles',
      JUEVES: 'Jueves',
      VIERNES: 'Viernes',
      SABADO: 'Sabado',
      DOMINGO: 'Domingo'
    };
    return labels[dia] ?? dia;
  }

  private buildHorarioResumen(horarios: HorarioEmpleadoResponse[]): HorarioResumen[] {
    const groups = new Map<string, {
      diaSemana: string;
      horaInicio: string;
      horaFin: string;
      fechas: Set<string>;
    }>();

    for (const horario of horarios) {
      const horaInicio = this.formatHora(horario.horaInicio);
      const horaFin = this.formatHora(horario.horaFin);
      const key = `${horario.diaSemana}|${horaInicio}|${horaFin}`;
      const current = groups.get(key) ?? {
        diaSemana: horario.diaSemana,
        horaInicio,
        horaFin,
        fechas: new Set<string>()
      };

      if (horario.fecha) {
        current.fechas.add(String(horario.fecha).substring(0, 10));
      }

      groups.set(key, current);
    }

    const order = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    return Array.from(groups.values())
      .sort((a, b) => {
        const dayCmp = order.indexOf(a.diaSemana) - order.indexOf(b.diaSemana);
        if (dayCmp !== 0) return dayCmp;
        return a.horaInicio.localeCompare(b.horaInicio);
      })
      .map(group => {
        const fechas = Array.from(group.fechas).sort();
        return {
          diaSemana: group.diaSemana,
          horaInicio: group.horaInicio,
          horaFin: group.horaFin,
          rangoFechas: this.formatRangoFechas(fechas),
          totalFechas: fechas.length
        };
      });
  }

  private formatHora(hora: string): string {
    return hora?.substring(0, 5) ?? '';
  }

  private formatRangoFechas(fechas: string[]): string {
    if (fechas.length === 0) return 'Horario recurrente';
    if (fechas.length === 1) return `Fecha: ${this.formatFechaCorta(fechas[0])}`;
    return `${this.formatFechaCorta(fechas[0])} - ${this.formatFechaCorta(fechas[fechas.length - 1])}`;
  }

  private formatFechaCorta(fecha: string): string {
    const [year, month, day] = fecha.split('-');
    if (!year || !month || !day) return fecha;
    return `${day}/${month}/${year}`;
  }
}
