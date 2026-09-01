import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
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
import { AuthService } from '../../core/services/auth.service';

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
  imports: [CommonModule, ReactiveFormsModule, ToastModule, DialogModule, SkeletonModule, InputFilterDirective],
  providers: [MessageService],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly mediaService = inject(MediaService);
  private readonly messageService = inject(MessageService);
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly loadingStore = inject(LoadingStore);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  profile = signal<ProfileResponse | null>(null);
  editMode = signal(false);
  uploadingPhoto = signal(false);
  previewUrl = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  mostrarHorario = signal(false);
  cargando = signal(true);
  showEmailChangeModal = signal(false);
  requestingEmailChange = signal(false);
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

  emailChangeForm: FormGroup = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    confirmEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    currentPassword: ['', [Validators.required, Validators.maxLength(72)]]
  });

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.cargando.set(true);
    this.loadingStore.show();
    this.profileService.getProfile().subscribe({
      next: (res) => {
        this.profile.set(res.data);
        this.patchForm(res.data);
        this.loadingStore.hide();
        this.cargando.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el perfil' });
        this.loadingStore.hide();
        this.cargando.set(false);
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

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.messageService.add({ severity: 'warn', summary: 'Formato no válido', detail: 'Solo se permiten imágenes JPG, PNG o WEBP' });
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
    return roles.map(role => role.replace(/^ROLE_/, '').replaceAll('_', ' ')).join(', ');
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

  openEmailChange() {
    this.emailChangeForm.reset();
    this.showEmailChangeModal.set(true);
  }

  requestEmailChange() {
    if (this.emailChangeForm.invalid) {
      this.emailChangeForm.markAllAsTouched();
      return;
    }
    const { newEmail, confirmEmail, currentPassword } = this.emailChangeForm.getRawValue();
    if (newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      this.messageService.add({ severity: 'warn', summary: 'Revisa los correos', detail: 'Los correos nuevos no coinciden' });
      return;
    }

    this.requestingEmailChange.set(true);
    this.authService.requestEmailChange(currentPassword, newEmail.trim().toLowerCase()).subscribe({
      next: () => {
        this.requestingEmailChange.set(false);
        this.showEmailChangeModal.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Confirmaciones enviadas',
          detail: 'Confirma la operación desde tu correo actual y desde el nuevo.'
        });
      },
      error: (err) => {
        this.requestingEmailChange.set(false);
        this.messageService.add({ severity: 'error', summary: 'No se pudo solicitar el cambio', detail: err.error?.message || 'Inténtalo nuevamente' });
      }
    });
  }

  get horariosResumen(): HorarioResumen[] {
    const horarios = this.profile()?.horarios?.filter(h => h.activo !== false) ?? [];
    return this.buildHorarioResumen(horarios).filter(h => this.estaVigente(h));
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

  get diaDeHoy(): HorarioDiaGrupo {
    const nombres = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const dia = nombres[new Date().getDay()];
    return this.semanaCompleta.find(d => d.diaSemana === dia) ?? { diaSemana: dia, label: this.formatDiaSemana(dia), bloques: [] };
  }

  get matrizHorario(): { horaSlot: string; dias: (HorarioResumen | null)[] }[] {
    const slotMap = new Map<string, Map<string, HorarioResumen>>();
    for (const h of this.horariosResumen) {
      const slot = `${h.horaInicio} – ${h.horaFin}`;
      if (!slotMap.has(slot)) slotMap.set(slot, new Map());
      slotMap.get(slot)!.set(h.diaSemana, h);
    }
    const slots = Array.from(slotMap.keys()).sort();
    return slots.map(slot => ({
      horaSlot: slot,
      dias: DIAS_SEMANA_ORDEN.map(dia => slotMap.get(slot)!.get(dia) ?? null)
    }));
  }

  get gridHorario(): { hora: string; dias: boolean[] }[] {
    const bloquesPorDia = new Map<string, { inicio: number; fin: number }[]>();
    for (const h of this.horariosResumen) {
      if (!bloquesPorDia.has(h.diaSemana)) bloquesPorDia.set(h.diaSemana, []);
      bloquesPorDia.get(h.diaSemana)!.push({
        inicio: parseInt(h.horaInicio.split(':')[0], 10),
        fin: parseInt(h.horaFin.split(':')[0], 10)
      });
    }
    let minHora = 24, maxHora = 0;
    for (const bloques of bloquesPorDia.values()) {
      for (const b of bloques) {
        if (b.inicio < minHora) minHora = b.inicio;
        if (b.fin > maxHora) maxHora = b.fin;
      }
    }
    if (minHora >= maxHora) return [];
    const filas: { hora: string; dias: boolean[] }[] = [];
    for (let h = minHora; h < maxHora; h++) {
      const horaInicio = `${String(h).padStart(2, '0')}:00`;
      const horaFin = `${String(h + 1).padStart(2, '0')}:00`;
      const dias = DIAS_SEMANA_ORDEN.map(dia => {
        const bloques = bloquesPorDia.get(dia) ?? [];
        return bloques.some(b => h >= b.inicio && h < b.fin);
      });
      filas.push({ hora: `${horaInicio} – ${horaFin}`, dias });
    }
    return filas;
  }

  get diasCortos(): string[] {
    return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  }

  fechaInicioSemana(): string {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diff = dia === 0 ? 6 : dia - 1;
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - diff);
    return this.formatFechaCorta(inicio.toISOString().substring(0, 10));
  }

  fechaFinSemana(): string {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diff = dia === 0 ? 0 : 7 - dia;
    const fin = new Date(hoy);
    fin.setDate(hoy.getDate() + diff);
    return this.formatFechaCorta(fin.toISOString().substring(0, 10));
  }

  esHoy(colIndex: number): boolean {
    const hoy = new Date().getDay();
    const map = [1, 2, 3, 4, 5, 6, 0];
    return map[colIndex] === hoy;
  }

  fechaDelDia(colIndex: number): number {
    const map = [1, 2, 3, 4, 5, 6, 0];
    const targetDay = map[colIndex];
    const hoy = new Date();
    const diff = targetDay - hoy.getDay();
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + diff);
    return fecha.getDate();
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

  private estaVigente(h: HorarioResumen): boolean {
    if (h.rangoFechas === 'Horario recurrente') return true;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    let fechaInicio: string | null = null;
    let fechaFin: string | null = null;
    if (h.rangoFechas.startsWith('Fecha:')) {
      const f = h.rangoFechas.replace('Fecha: ', '').split('/').reverse().join('-');
      fechaInicio = f;
      fechaFin = f;
    } else if (h.rangoFechas.includes(' - ')) {
      const parts = h.rangoFechas.split(' - ');
      fechaInicio = parts[0].split('/').reverse().join('-');
      fechaFin = parts[1].split('/').reverse().join('-');
    }
    if (!fechaInicio || !fechaFin) return true;
    const [yi, mi, di] = fechaInicio.split('-').map(Number);
    const [yf, mf, df] = fechaFin.split('-').map(Number);
    const inicio = new Date(yi, mi - 1, di);
    const fin = new Date(yf, mf - 1, df);
    return fin >= inicioSemana && inicio <= finSemana;
  }
}
