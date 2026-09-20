import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { CitaService } from '../../../core/services/cita.service';
import { CompanyService } from '../../../core/services/company.service';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { LoadingStore } from '../../../store/loading.store';
import { AuthStore } from '../../../store/auth.store';
import {
  HistoriaClinicaDetalle,
  ConsultaResumen,
  ArchivoClinico
} from '../../../models/response/historia-clinica-response';
import { ArchivoClinicoResponse } from '../../../models/response/archivo-clinico-response';
import { CitaResponse } from '../../../models/response/cita-response';
import { ArchivoModalsComponent } from '../form-hc/archivo-modals/archivo-modals.component';
import { DiagnosticoIaComponent } from './diagnostico-ia/diagnostico-ia.component';
import { formatearFechaClinica } from '../../../shared/utils/fecha-clinica.util';

@Component({
  selector: 'app-historia-clinica-mascota',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule, ArchivoModalsComponent, DiagnosticoIaComponent],
  providers: [MessageService],
  templateUrl: './historia-clinica-mascota.component.html'
})
export class HistoriaClinicaMascotaComponent implements OnInit, OnDestroy {
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly hcService    = inject(HistoriaClinicaService);
  private readonly citaService  = inject(CitaService);
  private readonly companyService = inject(CompanyService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly msgService   = inject(MessageService);
  private readonly sanitizer    = inject(DomSanitizer);
  readonly loadingStore         = inject(LoadingStore);
  readonly authStore            = inject(AuthStore);

  readonly canModify = computed(() => this.authStore.hasAccess('VISTA_HISTORIAS', 'modificar'));

  returnUrl           = '/historias-clinicas';
  mascotaId           = 0;
  numeroHc            = '';
  hc                  = signal<HistoriaClinicaDetalle | null>(null);
  consultaActiva      = signal<ConsultaResumen | null>(null);
  miniaturas          = signal<Map<number, string>>(new Map());
  seccionActiva       = signal<'consultas' | 'servicios' | 'preventivos'>('consultas');
  noTieneHc           = signal<boolean>(false);
  serviciosNoMedicos  = signal<CitaResponse[]>([]);
  loadingServicios    = signal(false);

  editandoAntecedentes = signal(false);
  guardandoAntecedentes = signal(false);
  antecedentesForm = {
    enfermedades: '',
    procedimientos: '',
    antecedentesPersonales: '',
    antecedentesFamiliares: '',
    grupoSanguineo: ''
  };

  readonly vacunas = computed(() =>
    (this.hc()?.aplicacionesPreventivas ?? []).filter(a => a.tipo === 'VACUNACION'));
  readonly desparasitaciones = computed(() =>
    (this.hc()?.aplicacionesPreventivas ?? []).filter(a => a.tipo === 'DESPARASITACION'));

  calendarioMes = signal(new Date().getMonth());
  calendarioAnio = signal(new Date().getFullYear());
  calendarioDiaSeleccionado = signal<number | null>(new Date().getDate());

  readonly calendarioMesInput = computed(() =>
    `${this.calendarioAnio()}-${String(this.calendarioMes() + 1).padStart(2, '0')}`);

  readonly controlesMesCalendario = computed(() => (this.hc()?.controlesPreventivos ?? [])
    .filter(control => {
      const fecha = this.parseLocalDate(control.fechaRecomendada);
      return fecha.getMonth() === this.calendarioMes() && fecha.getFullYear() === this.calendarioAnio();
    }));

  readonly controlesDiaSeleccionado = computed(() => {
    const dia = this.calendarioDiaSeleccionado();
    if (dia == null) return [];
    return this.controlesMesCalendario().filter(control =>
      this.parseLocalDate(control.fechaRecomendada).getDate() === dia);
  });
  readonly vacunasDiaSeleccionado = computed(() =>
    this.controlesDiaSeleccionado().filter(control => control.tipo === 'VACUNACION'));
  readonly desparasitacionesDiaSeleccionado = computed(() =>
    this.controlesDiaSeleccionado().filter(control => control.tipo === 'DESPARASITACION'));
  readonly controlesVacunacion = computed(() =>
    (this.hc()?.controlesPreventivos ?? [])
      .filter(control => control.tipo === 'VACUNACION' && this.esControlPendiente(control.estado))
      .sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada)));
  readonly controlesDesparasitacion = computed(() =>
    (this.hc()?.controlesPreventivos ?? [])
      .filter(control => control.tipo === 'DESPARASITACION' && this.esControlPendiente(control.estado))
      .sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada)));

  readonly controlesAtrasados = computed(() =>
    (this.hc()?.controlesPreventivos ?? []).filter(control => control.estado === 'ATRASADO').length);

  /** Historial completo (todos los estados, todos los meses) para no depender de navegar el calendario. */
  readonly todosLosControles = computed(() =>
    [...(this.hc()?.controlesPreventivos ?? [])].sort((a, b) => b.fechaRecomendada.localeCompare(a.fechaRecomendada)));

  historialBusqueda = signal('');
  historialFiltroTipo = signal<'TODOS' | 'VACUNACION' | 'DESPARASITACION'>('TODOS');

  readonly historialFiltrado = computed(() => {
    const texto = this.historialBusqueda().trim().toLowerCase();
    const tipo = this.historialFiltroTipo();
    return this.todosLosControles().filter(c =>
      (tipo === 'TODOS' || c.tipo === tipo)
      && (!texto || c.nombreControl.toLowerCase().includes(texto))
    );
  });

  estadoControlBadge(estado: string): string {
    const map: Record<string, string> = {
      APLICADO: 'bg-green-50 text-green-700',
      ATRASADO: 'bg-red-600 text-white',
      PENDIENTE: 'bg-amber-50 text-amber-700',
      PROXIMO: 'bg-blue-50 text-blue-700',
      PROGRAMADO: 'bg-slate-100 text-slate-600',
      SUSPENDIDO_POR_CITA: 'bg-slate-100 text-slate-500',
      CANCELADO: 'bg-slate-100 text-slate-500',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-600';
  }

  estadoControlLabel(estado: string): string {
    const map: Record<string, string> = {
      APLICADO: 'Aplicado', ATRASADO: 'Atrasado', PENDIENTE: 'Pendiente',
      PROXIMO: 'Próximo', PROGRAMADO: 'Programado',
      SUSPENDIDO_POR_CITA: 'Suspendido', CANCELADO: 'Cancelado',
    };
    return map[estado] ?? estado;
  }

  readonly fechaCalendarioSeleccionada = computed(() => {
    const dia = this.calendarioDiaSeleccionado();
    if (dia == null) return null;
    return new Date(this.calendarioAnio(), this.calendarioMes(), dia);
  });

  readonly fechaCalendarioSeleccionadaTexto = computed(() => {
    const fecha = this.fechaCalendarioSeleccionada();
    return fecha
      ? fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Selecciona un día del calendario';
  });

  readonly diasCalendario = computed(() => {
    const mes = this.calendarioMes();
    const anio = this.calendarioAnio();
    const primerDia = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const dias: { dia: number; vacias: string[]; desparas: string[] }[] = [];

    const controles = this.hc()?.controlesPreventivos ?? [];
    const mapa = new Map<number, { vacias: string[]; desparas: string[] }>();
    for (const c of controles) {
      const f = this.parseLocalDate(c.fechaRecomendada);
      if (f.getMonth() === mes && f.getFullYear() === anio) {
        const dia = f.getDate();
        const entry = mapa.get(dia) || { vacias: [], desparas: [] };
        if (c.tipo === 'VACUNACION') entry.vacias.push(c.nombreControl);
        else entry.desparas.push(c.nombreControl);
        mapa.set(dia, entry);
      }
    }

    for (let i = 1; i <= diasEnMes; i++) {
      const entry = mapa.get(i) || { vacias: [], desparas: [] };
      dias.push({ dia: i, vacias: entry.vacias, desparas: entry.desparas });
    }
    return { primerDia, dias };
  });

  mesNombre(mes: number): string {
    return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes];
  }

  calendarioMesAnterior() {
    const m = this.calendarioMes();
    if (m === 0) { this.calendarioMes.set(11); this.calendarioAnio.update(a => a - 1); }
    else this.calendarioMes.set(m - 1);
    this.calendarioDiaSeleccionado.set(null);
  }

  calendarioMesSiguiente() {
    const m = this.calendarioMes();
    if (m === 11) { this.calendarioMes.set(0); this.calendarioAnio.update(a => a + 1); }
    else this.calendarioMes.set(m + 1);
    this.calendarioDiaSeleccionado.set(null);
  }

  seleccionarDiaCalendario(dia: number) {
    this.calendarioDiaSeleccionado.set(dia);
  }

  onCalendarioMesInputChange(valor: string) {
    const [anio, mes] = valor.split('-').map(Number);
    if (!anio || !mes) return;
    this.calendarioAnio.set(anio);
    this.calendarioMes.set(mes - 1);
    this.calendarioDiaSeleccionado.set(null);
  }

  irAHoy() {
    const hoy = new Date();
    this.calendarioMes.set(hoy.getMonth());
    this.calendarioAnio.set(hoy.getFullYear());
    this.calendarioDiaSeleccionado.set(hoy.getDate());
  }

  calendarioEsMesActual(): boolean {
    const hoy = new Date();
    return this.calendarioMes() === hoy.getMonth() && this.calendarioAnio() === hoy.getFullYear();
  }

  private parseLocalDate(value: string): Date {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
  }

  private esControlPendiente(estado: string): boolean {
    return !['APLICADO', 'CANCELADO', 'SUSPENDIDO_POR_CITA'].includes(estado);
  }

  private enfocarProximoControl(historia: HistoriaClinicaDetalle) {
    const controles = [...(historia.controlesPreventivos ?? [])]
      .filter(control => !['APLICADO', 'CANCELADO', 'SUSPENDIDO_POR_CITA'].includes(control.estado))
      .sort((a, b) => a.fechaRecomendada.localeCompare(b.fechaRecomendada));
    if (!controles.length) return;
    const fecha = this.parseLocalDate(controles[0].fechaRecomendada);
    this.calendarioMes.set(fecha.getMonth());
    this.calendarioAnio.set(fecha.getFullYear());
    this.calendarioDiaSeleccionado.set(fecha.getDate());
  }

  previewArchivo   = signal<ArchivoClinicoResponse | null>(null);
  previewUrl       = signal<SafeResourceUrl | string>('');
  previewRawUrl    = signal<string>('');
  previewTipo      = signal<'imagen' | 'pdf' | 'dcm' | 'docx' | null>(null);
  previewCargando  = signal<boolean>(false);
  hoy = signal(new Date());

  ngOnInit() {
    this.route.queryParamMap.subscribe(qp => {
      if (qp.get('returnUrl')) this.returnUrl = qp.get('returnUrl')!;
    });
    this.route.params.subscribe(params => {
      this.numeroHc = params['numeroHc'];
      this.cargarHistoria(this.numeroHc);
    });
  }

  cargarHistoria(numeroHc: string) {
    this.loadingStore.show();
    this.hcService.getPorNumeroHc(numeroHc).subscribe({
      next: (res) => {
        this.mascotaId = res.data.mascotaId;
        this.hc.set(res.data);
        this.enfocarProximoControl(res.data);
        if (res.data.consultas.length > 0) {
          this.consultaActiva.set(res.data.consultas[0]);
          this.cargarMiniaturas(res.data.consultas[0]);
        }
        this.loadingStore.hide();
      },
      error: (err) => {
        this.loadingStore.hide();
        if (err.status === 404) {
          this.noTieneHc.set(true);
        } else {
          this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la historia clínica' });
        }
      }
    });
  }

  editarAntecedentes() {
    if (!this.canModify()) return;
    const hc = this.hc();
    if (!hc) return;
    this.antecedentesForm = {
      enfermedades: hc.enfermedades ?? '',
      procedimientos: hc.procedimientos ?? '',
      antecedentesPersonales: hc.antecedentesPersonales ?? '',
      antecedentesFamiliares: hc.antecedentesFamiliares ?? '',
      grupoSanguineo: hc.grupoSanguineo ?? ''
    };
    this.editandoAntecedentes.set(true);
  }

  cancelarEdicionAntecedentes() {
    this.editandoAntecedentes.set(false);
  }

  guardarAntecedentes() {
    const hc = this.hc();
    if (!hc) return;
    this.guardandoAntecedentes.set(true);
    this.hcService.actualizarAntecedentes(hc.id, this.antecedentesForm).subscribe({
      next: (res) => {
        this.hc.set({ ...hc, ...res.data });
        this.guardandoAntecedentes.set(false);
        this.editandoAntecedentes.set(false);
        this.msgService.add({ severity: 'success', summary: 'Guardado', detail: 'Antecedentes actualizados' });
      },
      error: () => {
        this.guardandoAntecedentes.set(false);
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron guardar los antecedentes' });
      }
    });
  }

  seleccionarConsulta(consulta: ConsultaResumen) {
    this.consultaActiva.set(consulta);
    this.seccionActiva.set('consultas');
    this.cargarMiniaturas(consulta);
  }

  esImagen(archivo: ArchivoClinico): boolean {
    if (archivo.tipo === 'IMAGEN') return true;
    const ext = archivo.nombre?.split('.').pop()?.toLowerCase();
    return ext === 'jpg' || ext === 'jpeg' || ext === 'png';
  }

  private cargarMiniaturas(consulta: ConsultaResumen) {
    const actuales = this.miniaturas();
    for (const archivo of consulta.archivos) {
      if (!this.esImagen(archivo) || actuales.has(archivo.id)) continue;
      this.hcService.obtenerContenidoArchivo(consulta.id, archivo.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const mapa = new Map(this.miniaturas());
          mapa.set(archivo.id, url);
          this.miniaturas.set(mapa);
        },
        error: () => {}
      });
    }
  }

  ngOnDestroy() {
    for (const url of this.miniaturas().values()) {
      URL.revokeObjectURL(url);
    }
  }

  seleccionarSeccion(seccion: 'consultas' | 'servicios' | 'preventivos') {
    this.seccionActiva.set(seccion);
    if (seccion === 'servicios' && this.mascotaId && this.serviciosNoMedicos().length === 0) {
      this.cargarServicios();
    }
  }

  cargarServicios() {
    this.loadingServicios.set(true);
    this.citaService.getServiciosNoMedicos(this.mascotaId).subscribe({
      next: (res) => {
        this.serviciosNoMedicos.set(res.data ?? []);
        this.loadingServicios.set(false);
      },
      error: () => this.loadingServicios.set(false)
    });
  }

  editarConsulta(id: number) {
    if (!this.canModify()) return;
    this.router.navigate(['/historias-clinicas/consulta', id], {
      queryParams: {
        returnUrl: '/historias-clinicas/mascota/' + this.numeroHc,
        mode: 'edit'
      }
    });
  }

  volver() {
    this.router.navigateByUrl(this.returnUrl);
  }

  irARegistrarControl(tipo: 'VACUNACION' | 'DESPARASITACION') {
    this.router.navigate(['/historias-clinicas/cartilla'], { queryParams: { petId: this.mascotaId, modo: tipo } });
  }

  formatFecha(fecha: string): string {
    return formatearFechaClinica(fecha);
  }

  formatFechaHora(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private async descargarComoDataUrl(url: string): Promise<string | null> {
    try {
      const blob = await fetch(url).then(r => r.blob());
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async descargarCartilla(tipo: 'vacunacion' | 'desparasitacion'): Promise<void> {
    const hc = this.hc();
    if (!hc) return;
    const items = tipo === 'vacunacion' ? this.vacunas() : this.desparasitaciones();
    const titulo = tipo === 'vacunacion' ? 'Cartilla de vacunación' : 'Cartilla de desparasitación';
    const columnaProducto = tipo === 'vacunacion' ? 'Vacuna' : 'Producto';

    const companyId = this.authStore.selectedEnterprise()?.establishmentId ?? this.authStore.companyId() ?? null;
    const empresa = companyId != null
      ? await firstValueFrom(this.companyService.getById(companyId)).then(r => r.data).catch(() => null)
      : null;
    const logoDataUrl = empresa?.logoUrl ? await this.descargarComoDataUrl(empresa.logoUrl) : null;

    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new JsPdf();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;
    const primary: [number, number, number] = [0, 102, 170];
    const muted: [number, number, number] = [71, 85, 105];
    const dark: [number, number, number] = [30, 41, 59];
    const border: [number, number, number] = [226, 232, 240];

    // Encabezado: logo y datos reales de la empresa (igual que en los reportes clínicos)
    let textoX = marginX;
    let logoAlto = 0;
    if (logoDataUrl) {
      try {
        // Respetar la proporción real del logo en vez de forzarlo a un cuadro fijo,
        // que lo deja estirado si el logo no es cuadrado.
        const props = doc.getImageProperties(logoDataUrl);
        const maxAncho = 18;
        const maxAlto = 16;
        let ancho = maxAncho;
        let alto = (ancho * props.height) / props.width;
        if (alto > maxAlto) {
          alto = maxAlto;
          ancho = (alto * props.width) / props.height;
        }
        doc.addImage(logoDataUrl, marginX, 10, ancho, alto);
        textoX = marginX + ancho + 6;
        logoAlto = alto;
      } catch {
        // Si el logo no se pudo decodificar, se omite sin bloquear el resto del PDF
      }
    }
    doc.setTextColor(...dark);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa?.name ?? this.authStore.companyName() ?? 'Clínica veterinaria', textoX, 16);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    const detalle = [empresa?.address, empresa?.phone, empresa?.email].filter(Boolean).join('   ·   ');
    if (detalle) doc.text(detalle, textoX, 21.5);
    if (empresa?.ruc) doc.text(`RUC: ${empresa.ruc}`, textoX, 26);

    let y = Math.max(10 + logoAlto, 30) + 4;
    doc.setDrawColor(...border);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 10;

    doc.setTextColor(...dark);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, marginX, y);
    y += 10;

    // Ficha de identificación de la mascota, en una tarjeta con fondo para que
    // resalte claramente del resto (esto es lo que hace que se vea como cartilla).
    const fichaAlto = 34;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...border);
    doc.roundedRect(marginX, y, contentWidth, fichaAlto, 2, 2, 'FD');

    const datos: [string, string][] = [
      ['Mascota', hc.mascotaNombre],
      ['Especie / Raza', `${hc.especie ?? '—'} / ${hc.raza ?? '—'}`],
      ['Sexo', hc.sexo ?? '—'],
      ['Propietario', hc.propietarioNombre ?? '—'],
      ['N° de historia clínica', hc.numeroHc],
    ];
    const filaAltura = 12;
    datos.forEach(([label, valor], index) => {
      const col = index % 2;
      const fila = Math.floor(index / 2);
      const colX = marginX + 6 + col * (contentWidth / 2);
      const filaY = y + 8 + fila * filaAltura;
      doc.setTextColor(...muted);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), colX, filaY);
      doc.setTextColor(...dark);
      doc.setFontSize(11);
      doc.text(valor, colX, filaY + 5.5);
      doc.setFont('helvetica', 'normal');
    });
    y += fichaAlto + 10;

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { font: 'helvetica', fontSize: 9, textColor: dark, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      head: [['N°', columnaProducto, 'Aplicada', 'Próxima', 'Cada', 'Veterinario']],
      body: items.map((item, index) => [
        `${index + 1}`,
        item.nombreControl,
        this.formatFecha(item.fechaAplicacion),
        item.fechaProximaAplicacion ? this.formatFecha(item.fechaProximaAplicacion) : '—',
        item.periodicidadMeses ? `${item.periodicidadMeses} meses` : '—',
        item.veterinarioNombre || '—'
      ]),
      columnStyles: { 0: { cellWidth: 10 } }
    });

    // El nombre del archivo no debe llevar el número de historia clínica (dato interno
    // identificable) ni quedar expuesto en el historial de descargas del navegador.
    const nombreArchivo = hc.mascotaNombre.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '-') || 'mascota';
    doc.save(`${tipo === 'vacunacion' ? 'cartilla-vacunacion' : 'cartilla-desparasitacion'}-${nombreArchivo}.pdf`);
    this.auditLogService.registrarDescarga(
      tipo === 'vacunacion' ? 'CARTILLA_VACUNACION' : 'CARTILLA_DESPARASITACION',
      hc.mascotaNombre
    ).subscribe();
  }

  edadTexto(meses: number | undefined): string {
    if (!meses) return '—';
    if (meses >= 12) {
      const años = Math.floor(meses / 12);
      return `${años} año${años > 1 ? 's' : ''}`;
    }
    return `${meses} mes${meses > 1 ? 'es' : ''}`;
  }

  tipoConsultaLabel(tipo: string): string {
    const map: Record<string, string> = {
      CONSULTA_GENERAL: 'General',
      URGENCIA: 'Urgencia',
      CONTROL: 'Control',
      CIRUGIA: 'Cirugía',
      VACUNACION: 'Vacunación',
      DESPARASITACION: 'Desparasitación'
    };
    return map[tipo] ?? tipo;
  }

  estadoCitaBadge(estado: string): string {
    const map: Record<string, string> = {
      COMPLETADA: 'bg-green-50 text-green-700',
      CANCELADA: 'bg-red-50 text-red-600',
      ELIMINADA: 'bg-red-50 text-red-600',
      EN_PROCESO: 'bg-blue-50 text-blue-700',
      PROGRAMADA: 'bg-slate-100 text-slate-600',
      CONFIRMADA: 'bg-indigo-50 text-indigo-700',
      PENDIENTE: 'bg-amber-50 text-amber-700',
      REPROGRAMADA: 'bg-orange-50 text-orange-600',
      SALA_DE_ESPERA: 'bg-cyan-50 text-cyan-700',
      NO_ASISTIO: 'bg-slate-100 text-slate-500',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-600';
  }

  estadoCitaLabel(estado: string): string {
    const map: Record<string, string> = {
      COMPLETADA: 'Completada', CANCELADA: 'Cancelada', EN_PROCESO: 'En proceso',
      PROGRAMADA: 'Programada', CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente',
      REPROGRAMADA: 'Reprogramada', SALA_DE_ESPERA: 'En espera',
      NO_ASISTIO: 'No asistió', ELIMINADA: 'Eliminada', OTRO: 'Otro',
    };
    return map[estado] ?? estado;
  }

  tipoArchivoLabel(tipo: string): string {
    const map: Record<string, string> = {
      IMAGEN: 'Imagen',
      PDF: 'PDF',
      LABORATORIO: 'Laboratorio',
      RADIOGRAFIA: 'Radiografía',
      ECOGRAFIA: 'Ecografía',
      DOCUMENTO: 'Documento',
      OTRO: 'Otro'
    };
    return map[tipo] ?? tipo;
  }

  tipoArchivoBadge(tipo: string): string {
    switch (tipo) {
      case 'RADIOGRAFIA': return 'bg-violet-50 text-violet-700';
      case 'LABORATORIO': return 'bg-amber-50 text-amber-700';
      case 'ECOGRAFIA':   return 'bg-teal-50 text-teal-700';
      case 'PDF':         return 'bg-red-50 text-red-600';
      case 'IMAGEN':      return 'bg-blue-50 text-blue-700';
      case 'DOCUMENTO':   return 'bg-indigo-50 text-indigo-700';
      default:            return 'bg-slate-100 text-slate-500';
    }
  }

  formatBytes(bytes: number | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  visualizarArchivo(archivo: ArchivoClinico): void {
    const ext = archivo.nombre?.split('.').pop()?.toLowerCase() ?? '';
    const consultaId = this.consultaActiva()?.id;
    if (!consultaId) return;

    if (ext === 'dcm') {
      this.previewArchivo.set(archivo as unknown as ArchivoClinicoResponse);
      this.previewTipo.set('dcm');
      this.previewUrl.set('');
      return;
    }

    if (ext === 'docx' || ext === 'doc') {
      this.previewArchivo.set(archivo as unknown as ArchivoClinicoResponse);
      this.previewTipo.set('docx');
      this.previewUrl.set('');
      return;
    }

    this.previewCargando.set(true);
    this.hcService.obtenerContenidoArchivo(consultaId, archivo.id).subscribe({
      next: (blob) => {
        if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
        const mime = archivo.tipoMime || blob.type || 'application/octet-stream';
        const typedBlob = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mime });
        const objectUrl = URL.createObjectURL(typedBlob);
        this.previewRawUrl.set(objectUrl);
        this.previewUrl.set(ext === 'pdf'
          ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl)
          : objectUrl);
        this.previewArchivo.set(archivo as unknown as ArchivoClinicoResponse);
        this.previewTipo.set(ext === 'pdf' ? 'pdf' : 'imagen');
        this.previewCargando.set(false);
      },
      error: () => {
        this.previewCargando.set(false);
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el archivo' });
      }
    });
  }

  cerrarPreview(): void {
    if (this.previewRawUrl()) URL.revokeObjectURL(this.previewRawUrl());
    this.previewRawUrl.set('');
    this.previewUrl.set('');
    this.previewArchivo.set(null);
    this.previewTipo.set(null);
  }

  descargarArchivo(archivo: ArchivoClinicoResponse): void {
    const consultaId = this.consultaActiva()?.id;
    if (!consultaId) return;
    this.hcService.obtenerContenidoArchivo(consultaId, archivo.id, true).subscribe({
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
}
