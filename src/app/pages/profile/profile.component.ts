import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProfileService } from '../../core/services/profile.service';
import { MediaService } from '../../core/services/media.service';
import { ProfileResponse } from '../../models/response/profile-response';
import { HorarioEmpleadoResponse } from '../../models/response/horario-empleado-response';
import { LoadingStore } from '../../store/loading.store';
import { AuthStore } from '../../store/auth.store';
import { InputFilterDirective } from '../../core/directives/input-filter.directive';
import { noLeadingTrailingSpaceValidator } from '../../core/validators/no-leading-trailing-space.validator';
import { textContentValidator } from '../../core/validators/text-content.validator';
import { normalizeText } from '../../core/utils/normalize-text.util';

interface HorarioResumen {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  rangoFechas: string;
  totalFechas: number;
}

interface HorarioDiaGrupo {
  diaSemana: string;
  label: string;
  bloques: { horaInicio: string; horaFin: string; rangoFechas: string; totalFechas: number }[];
}

const DIAS_SEMANA_ORDEN = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToastModule, InputFilterDirective],
  providers: [MessageService],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly mediaService = inject(MediaService);
  private readonly messageService = inject(MessageService);
  private readonly authStore = inject(AuthStore);
  private readonly sanitizer = inject(DomSanitizer);
  readonly loadingStore = inject(LoadingStore);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  profile = signal<ProfileResponse | null>(null);
  editMode = signal(false);
  uploadingPhoto = signal(false);
  previewUrl = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  readonly safePreviewUrl = computed(() => {
    const url = this.previewUrl();
    return url ? this.sanitizer.bypassSecurityTrustUrl(url) : null;
  });

  form: FormGroup = this.fb.group({
    nombre:        ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    apellido:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/), noLeadingTrailingSpaceValidator()]],
    telefono:      ['', [Validators.pattern(/^\d{9}$/)]],
    direccion:     ['', [Validators.maxLength(200), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    observaciones: ['', [Validators.maxLength(500), noLeadingTrailingSpaceValidator(), textContentValidator()]],
    fotoUrl:       ['', [Validators.maxLength(500)]]
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
    if (!this.canModifyProfile) return;
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

    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  ngOnDestroy() {
    if (this.previewUrl() && this.previewUrl()!.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
  }

  save() {
    if (!this.canModifyProfile) {
      this.editMode.set(false);
      this.messageService.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No tienes permiso para editar tu perfil' });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Campos inválidos', detail: 'Revisa los campos del formulario' });
      return;
    }

    const doSave = (fotoUrl?: string) => {
      this.loadingStore.show();
      const raw = this.form.value;
      const payload = {
        ...raw,
        nombre:        normalizeText(raw.nombre),
        apellido:      normalizeText(raw.apellido),
        telefono:      raw.telefono?.trim(),
        direccion:     normalizeText(raw.direccion),
        observaciones: normalizeText(raw.observaciones)
      };
      if (fotoUrl) payload.fotoUrl = fotoUrl;

      this.profileService.updateProfile(payload).subscribe({
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
    };

    const file = this.selectedFile();
    if (file) {
      this.uploadingPhoto.set(true);
      this.mediaService.upload(file).subscribe({
        next: (url) => {
          this.selectedFile.set(null);
          this.uploadingPhoto.set(false);
          doSave(url);
        },
        error: () => {
          this.uploadingPhoto.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir la imagen' });
        }
      });
    } else {
      doSave();
    }
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

  get canModifyProfile(): boolean {
    return this.authStore.hasAccess('VISTA_PROFILE', 'modificar');
  }

  get horariosResumen(): HorarioResumen[] {
    const horarios = this.profile()?.horarios?.filter(h => h.activo !== false) ?? [];
    return this.buildHorarioResumen(horarios);
  }

  get semanaCompleta(): HorarioDiaGrupo[] {
    const resumen = this.horariosResumen;
    const groups = new Map<string, HorarioDiaGrupo>();

    for (const h of resumen) {
      if (!groups.has(h.diaSemana)) {
        groups.set(h.diaSemana, { diaSemana: h.diaSemana, label: this.formatDiaSemana(h.diaSemana), bloques: [] });
      }
      groups.get(h.diaSemana)!.bloques.push({
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        rangoFechas: h.rangoFechas,
        totalFechas: h.totalFechas
      });
    }

    return DIAS_SEMANA_ORDEN.map(dia =>
      groups.get(dia) ?? { diaSemana: dia, label: this.formatDiaSemana(dia), bloques: [] }
    );
  }

  formatDiaSemana(dia: string): string {
    const labels: Record<string, string> = {
      LUNES: 'Lunes',
      MARTES: 'Martes',
      MIERCOLES: 'Miércoles',
      JUEVES: 'Jueves',
      VIERNES: 'Viernes',
      SABADO: 'Sábado',
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
