import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuditLogService, AuditLog } from '../../../core/services/audit-log.service';
import { CompanyService } from '../../../core/services/company.service';
import { AuthStore } from '../../../store/auth.store';
import { CompanyListResponse } from '../../../models/response/company-list-response';
import { normalizeText } from '../../../core/utils/normalize-text.util';
import { isDateRangeValid, isLowercaseEmail } from '../../../core/utils/input-validation.util';
import { RealtimeStompConnection, RealtimeStompService } from '../../../core/services/realtime-stomp.service';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Toast,
    PaginatorModule
  ],
  providers: [MessageService],
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.scss'
})
export class AuditoriaComponent implements OnInit, OnDestroy {
  private readonly auditLogService = inject(AuditLogService);
  private readonly companyService = inject(CompanyService);
  private readonly messageService = inject(MessageService);
  private readonly realtimeStompService = inject(RealtimeStompService);
  readonly authStore = inject(AuthStore);

  private realtimeConnection: RealtimeStompConnection | null = null;
  private lastSubscribedDestination: string | null = null;
  private loadTimeout: any = null;
  private realtimeStatusInterval: any = null;

  readonly realtimeConnected = signal(false);

  readonly isSuperAdmin = computed(() => this.authStore.isSuperAdmin());

  logs = signal<AuditLog[]>([]);
  totalRecords = signal<number>(0);
  companies = signal<CompanyListResponse[]>([]);

  // Filtros
  selectedCompanyId: number | null = null;
  userEmailFilter: string = '';
  actionFilter: string = '';
  moduleFilter: string = '';
  startDateFilter: string = '';
  endDateFilter: string = '';

  // Paginación actual
  currentPage = 0;
  readonly pageSize = 10;

  modulesList = [
    'Seguridad', 'Citas', 'Mascotas', 'Usuarios',
    'Clientes', 'Facturación', 'Consultas', 'Horarios', 'Empleados',
    'Cartilla', 'Recetas', 'Reportes'
  ];

  actionsList = [
    'LOGIN_EXITOSO', 'CAMBIO_ROL', 'CAMBIO_CONTRASENA', 'RESET_CONTRASENA',
    'SUSPENSION_CUENTA', 'CONSULTA_AUDITORIA',
    'CONSULTAR_EMPLEADOS', 'CONSULTAR_DETALLE_EMPLEADO',
    'CONSULTAR_APODERADOS', 'CONSULTAR_DETALLE_APODERADO',
    'CONSULTAR_MASCOTAS',
    'CONSULTAR_HISTORIAS_CLINICAS', 'CONSULTAR_DETALLE_HISTORIA_CLINICA', 'CONSULTAR_HISTORIA_CLINICA_MASCOTA',
    'CONSULTAR_CITAS', 'CONSULTAR_CAJA',
    'CREAR_EMPLEADO', 'ACTUALIZAR_EMPLEADO',
    'ACTIVAR_EMPLEADO', 'DESACTIVAR_EMPLEADO', 'ELIMINAR_EMPLEADO', 'ASIGNAR_HORARIOS_MASIVO',
    'CLONAR_HORARIOS_SEMANA', 'CLONAR_HORARIOS_DIA', 'ELIMINAR_HORARIOS_MASIVO',
    'REGISTRAR_MASCOTA', 'ACTUALIZAR_MASCOTA', 'ACTIVAR_MASCOTA', 'DESACTIVAR_MASCOTA',
    'CREAR_APODERADO', 'ACTUALIZAR_APODERADO', 'ACTIVAR_APODERADO', 'DESACTIVAR_APODERADO',
    'ELIMINAR_APODERADO', 'CREAR_CITA', 'REPROGRAMAR_CITA', 'CANCELAR_CITA',
    'ELIMINAR_CITA', 'INICIAR_ATENCION', 'ACTUALIZAR_CONSULTA', 'CERRAR_CONSULTA',
    'REGISTRAR_PAGO', 'CREAR_ROL', 'ACTUALIZAR_ROL', 'ELIMINAR_ROL',
    'CREAR_MENU', 'ACTUALIZAR_MENU', 'ELIMINAR_MENU',
    'DESCARGAR_PDF_HORARIO', 'DESCARGAR_EXCEL_HORARIO',
    'DESCARGAR_CARTILLA_VACUNACION', 'DESCARGAR_CARTILLA_DESPARASITACION',
    'IMPRIMIR_RECETA', 'DESCARGAR_REPORTE_PDF', 'DESCARGAR_REPORTE_EXCEL',
    'EXPORTAR_AUDITORIA'
  ];

  private initialized = false;

  constructor() {
    effect(() => {
      // Registrar dependencias reactivas
      const enterprise = this.authStore.selectedEnterprise();
      const compId = this.authStore.companyId();

      untracked(() => {
        if (!this.initialized) {
          // Primera ejecución: carga inicial con flag de auditoría
          this.initialized = true;
          this.executeLoadLogs(0, true);
        } else {
          // Ejecuciones posteriores: cambio de empresa u otro signal
          this.applyFilters();
        }
      });
    });
  }

  ngOnInit() {
    if (this.isSuperAdmin()) {
      this.companyService.listar(0, 1000).subscribe({
        next: (res) => {
          this.companies.set(res.data.content || []);
        }
      });
    }
    // La carga inicial de logs la gestiona el effect() del constructor
    this.realtimeStatusInterval = setInterval(() => {
      this.realtimeConnected.set(this.realtimeConnection?.isConnected() ?? false);
    }, 3000);
  }

  ngOnDestroy() {
    this.realtimeConnection?.disconnect();
    if (this.loadTimeout) clearTimeout(this.loadTimeout);
    if (this.realtimeStatusInterval) clearInterval(this.realtimeStatusInterval);
  }

  setupWebSocket(targetCompanyId: number | undefined) {
    const destination = targetCompanyId
      ? `/topic/audit-logs/${targetCompanyId}`
      : '/topic/audit-logs';

    // Evitar reconexiones si ya estamos escuchando o conectando al mismo destino y está activo
    if (this.lastSubscribedDestination === destination && this.realtimeConnection?.isActive()) {
      return;
    }

    this.realtimeConnection?.disconnect();

    this.lastSubscribedDestination = destination;

    this.realtimeConnection = this.realtimeStompService.connect<AuditLog>(destination, newLog => {
      if (!this.matchesActiveFilters(newLog)) return;

      if (this.currentPage === 0) {
        this.logs.update(current => {
          if (current.some(log => log.id === newLog.id)) return current;
          return [newLog, ...current.slice(0, this.pageSize - 1)];
        });
      }
      this.totalRecords.update(total => total + 1);
    }, { label: 'Auditoría' });
  }

  private matchesActiveFilters(log: AuditLog): boolean {
    const userEmail = this.userEmailFilter.trim().toLowerCase();
    if (userEmail && !log.userEmail?.toLowerCase().includes(userEmail)) return false;

    const action = normalizeText(this.actionFilter);
    if (action && normalizeText(log.action) !== action) return false;

    const module = normalizeText(this.moduleFilter);
    if (module && normalizeText(log.module) !== module) return false;

    const timestamp = new Date(log.timestamp).getTime();
    if (this.startDateFilter) {
      const start = new Date(`${this.startDateFilter}T00:00:00`).getTime();
      if (timestamp < start) return false;
    }
    if (this.endDateFilter) {
      const end = new Date(`${this.endDateFilter}T23:59:59`).getTime();
      if (timestamp > end) return false;
    }

    return true;
  }

  loadLogs(page: number = 0) {
    this.currentPage = page;

    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }

    this.loadTimeout = setTimeout(() => {
      // Navegación de página y filtros nunca son initialLoad
      this.executeLoadLogs(page, false);
    }, 50);
  }

  /** Devuelve los filtros activos ya validados/normalizados, o null si son inválidos (y avisa al usuario). */
  private buildActiveFilters(): {
    companyId?: number; userEmail?: string; action?: string; module?: string; startDate?: string; endDate?: string;
  } | null {
    const userEmail = this.userEmailFilter.trim();
    const action = normalizeText(this.actionFilter).slice(0, 80);
    const module = normalizeText(this.moduleFilter).slice(0, 80);

    if (userEmail && !isLowercaseEmail(userEmail, 100)) {
      this.messageService.add({ severity: 'warn', summary: 'Correo invalido', detail: 'El filtro de correo debe ser valido y estar en minusculas.' });
      return null;
    }
    if (!isDateRangeValid(this.startDateFilter, this.endDateFilter)) {
      this.messageService.add({ severity: 'warn', summary: 'Rango invalido', detail: 'La fecha final no puede ser anterior a la fecha inicial.' });
      return null;
    }

    const formattedStart = this.startDateFilter ? `${this.startDateFilter}T00:00:00` : undefined;
    const formattedEnd = this.endDateFilter ? `${this.endDateFilter}T23:59:59` : undefined;

    let targetCompanyId: number | undefined = undefined;
    if (this.isSuperAdmin()) {
      targetCompanyId = this.selectedCompanyId || undefined;
    } else {
      targetCompanyId = this.authStore.companyId() || undefined;
    }

    return {
      companyId: targetCompanyId,
      userEmail: userEmail || undefined,
      action: action || undefined,
      module: module || undefined,
      startDate: formattedStart,
      endDate: formattedEnd
    };
  }

  private executeLoadLogs(page: number, initialLoad = false) {
    const filters = this.buildActiveFilters();
    if (!filters) return;

    this.auditLogService.getLogs({
      ...filters,
      page: page,
      size: this.pageSize,
      sort: 'timestamp,desc',
      initialLoad: initialLoad || undefined
    }).subscribe({
      next: (res) => {
        const data = res.data as any;
        const total = data.totalElements ?? data.page?.totalElements ?? 0;
        this.logs.set(data.content ?? []);
        this.totalRecords.set(total);
        this.setupWebSocket(filters.companyId);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener los registros de auditoría' });
      }
    });
  }

  applyFilters() {
    this.loadLogs(0);
  }

  clearFilters() {
    this.selectedCompanyId = null;
    this.userEmailFilter = '';
    this.actionFilter = '';
    this.moduleFilter = '';
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.applyFilters();
  }

  readonly exportando = signal(false);

  /** true si hay al menos un filtro activo (además del scope de empresa forzado a usuarios no superadmin) */
  private hayFiltrosActivos(): boolean {
    return !!(this.userEmailFilter.trim() || this.actionFilter || this.moduleFilter
      || this.startDateFilter || this.endDateFilter || (this.isSuperAdmin() && this.selectedCompanyId));
  }

  private nombreEmpresaParaExport(companyId?: number): string {
    if (companyId != null) {
      const found = this.companies().find(c => c.id === companyId);
      if (found) return found.name;
    }
    if (!this.isSuperAdmin()) {
      return this.authStore.companyName() || 'Mi empresa';
    }
    return 'Todas las empresas (Multi-sede)';
  }

  private fetchLogsParaExport(): Promise<AuditLog[]> {
    const filters = this.buildActiveFilters();
    if (!filters) return Promise.reject(new Error('Filtros inválidos'));

    return new Promise((resolve, reject) => {
      this.auditLogService.exportLogs(filters).subscribe({
        next: res => resolve(res.data ?? []),
        error: () => reject(new Error('No se pudieron obtener los registros'))
      });
    });
  }

  async exportarPdf() {
    if (this.exportando()) return;
    this.exportando.set(true);
    try {
      const filters = this.buildActiveFilters();
      if (!filters) { this.exportando.set(false); return; }
      const logs = await this.fetchLogsParaExport();
      const conFiltros = this.hayFiltrosActivos();
      const empresaNombre = this.nombreEmpresaParaExport(filters.companyId);
      const fechaEmision = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

      const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);
      const doc = new JsPdf('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 12;
      const dark: [number, number, number] = [15, 23, 42];
      const gray: [number, number, number] = [71, 85, 105];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...dark);
      doc.text('Historial de Auditoría', marginX, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...gray);
      doc.text(`${empresaNombre} — ${conFiltros ? 'Reporte filtrado' : 'Reporte completo'} — Emitido: ${fechaEmision}`, marginX, 20);
      doc.text(`Total de registros: ${logs.length}`, pageWidth - marginX, 20, { align: 'right' });

      autoTable(doc, {
        startY: 25,
        head: [['Fecha / Hora', 'Usuario', 'Rol', 'Clínica', 'Módulo', 'Acción', 'Detalle', 'IP']],
        body: logs.map(l => [
          new Date(l.timestamp).toLocaleString('es-PE'),
          l.userEmail || 'Anónimo / Sistema',
          l.userRole || '-',
          l.companyName || 'Multi-Sede',
          l.module,
          l.action,
          l.details || '',
          l.ipAddress || 'Interna'
        ]),
        styles: { fontSize: 6.5, cellPadding: 1.5, textColor: dark, lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [248, 250, 252], textColor: dark, fontStyle: 'bold', lineColor: dark, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 30 }, 1: { cellWidth: 38 }, 2: { cellWidth: 20 }, 3: { cellWidth: 28 },
          4: { cellWidth: 22 }, 5: { cellWidth: 30 }, 7: { cellWidth: 22 }
        },
        margin: { left: marginX, right: marginX }
      });

      doc.save(`auditoria-${conFiltros ? 'filtrada' : 'completa'}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el PDF de auditoría' });
    } finally {
      this.exportando.set(false);
    }
  }

  async exportarExcel() {
    if (this.exportando()) return;
    this.exportando.set(true);
    try {
      const filters = this.buildActiveFilters();
      if (!filters) { this.exportando.set(false); return; }
      const logs = await this.fetchLogsParaExport();
      const conFiltros = this.hayFiltrosActivos();
      const empresaNombre = this.nombreEmpresaParaExport(filters.companyId);
      const fechaEmision = new Date().toLocaleDateString('es-PE');

      const ExcelJSModule = await import('exceljs');
      const ExcelJSRuntime = ExcelJSModule.default ?? ExcelJSModule;
      const workbook = new ExcelJSRuntime.Workbook();
      workbook.creator = empresaNombre;
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Auditoría', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
      });

      sheet.columns = [
        { width: 20 }, { width: 26 }, { width: 14 }, { width: 20 },
        { width: 16 }, { width: 22 }, { width: 45 }, { width: 16 }
      ];

      sheet.mergeCells('A1:H1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `HISTORIAL DE AUDITORÍA — ${empresaNombre.toUpperCase()} (${conFiltros ? 'FILTRADO' : 'COMPLETO'})`;
      titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      titleCell.border = { bottom: { style: 'medium', color: { argb: 'FF0F172A' } } };
      sheet.getRow(1).height = 28;

      sheet.mergeCells('A2:H2');
      const subtitleCell = sheet.getCell('A2');
      subtitleCell.value = `Emitido: ${fechaEmision}  —  Total de registros: ${logs.length}`;
      subtitleCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF64748B' } };
      sheet.getRow(2).height = 16;
      sheet.getRow(3).height = 6;

      const hdrRow = sheet.getRow(4);
      hdrRow.height = 20;
      ['Fecha / Hora', 'Usuario', 'Rol', 'Clínica', 'Módulo', 'Acción', 'Detalle', 'IP'].forEach((label, col) => {
        const cell = hdrRow.getCell(col + 1);
        cell.value = label;
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      });

      logs.forEach((l, idx) => {
        const row = sheet.getRow(5 + idx);
        const values = [
          new Date(l.timestamp).toLocaleString('es-PE'),
          l.userEmail || 'Anónimo / Sistema',
          l.userRole || '-',
          l.companyName || 'Multi-Sede',
          l.module,
          l.action,
          l.details || '',
          l.ipAddress || 'Interna'
        ];
        values.forEach((v, col) => {
          const cell = row.getCell(col + 1);
          cell.value = v;
          cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: col === 6, indent: 1 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF' } };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `auditoria-${conFiltros ? 'filtrada' : 'completa'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el Excel de auditoría' });
    } finally {
      this.exportando.set(false);
    }
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'LOGIN_EXITOSO':
        return 'bg-teal-50 border-teal-200 text-teal-700';
      case 'CONSULTA_AUDITORIA':
        return 'bg-violet-50 border-violet-200 text-violet-700';
      case 'CONSULTAR_EMPLEADOS':
      case 'CONSULTAR_DETALLE_EMPLEADO':
      case 'CONSULTAR_APODERADOS':
      case 'CONSULTAR_DETALLE_APODERADO':
      case 'CONSULTAR_MASCOTAS':
      case 'CONSULTAR_HISTORIAS_CLINICAS':
      case 'CONSULTAR_DETALLE_HISTORIA_CLINICA':
      case 'CONSULTAR_HISTORIA_CLINICA_MASCOTA':
      case 'CONSULTAR_CITAS':
      case 'CONSULTAR_CAJA':
        return 'bg-slate-50 border-slate-200 text-slate-700';
      case 'SUSPENSION_CUENTA':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'CAMBIO_ROL':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'CAMBIO_CONTRASENA':
      case 'RESET_CONTRASENA':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'CREAR_CITA':
      case 'REGISTRAR_MASCOTA':
      case 'CREAR_APODERADO':
      case 'CREAR_EMPLEADO':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'ACTUALIZAR_CITA':
      case 'REPROGRAMAR_CITA':
      case 'ACTUALIZAR_MASCOTA':
      case 'ACTUALIZAR_APODERADO':
      case 'ACTUALIZAR_EMPLEADO':
      case 'ACTUALIZAR_CONSULTA':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'ACTIVAR_MASCOTA':
      case 'ACTIVAR_APODERADO':
      case 'ACTIVAR_EMPLEADO':
      case 'ASIGNAR_HORARIOS_MASIVO':
      case 'CLONAR_HORARIOS_SEMANA':
      case 'CLONAR_HORARIOS_DIA':
      case 'REGISTRAR_PAGO':
        return 'bg-cyan-50 border-cyan-200 text-cyan-700';
      case 'DESACTIVAR_MASCOTA':
      case 'DESACTIVAR_APODERADO':
      case 'DESACTIVAR_EMPLEADO':
      case 'ELIMINAR_CITA':
      case 'ELIMINAR_APODERADO':
      case 'ELIMINAR_EMPLEADO':
      case 'ELIMINAR_HORARIOS_MASIVO':
      case 'CANCELAR_CITA':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  }

  getModuleBadgeClass(module: string): string {
    switch (module) {
      case 'Seguridad':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'Citas':
        return 'bg-sky-50 border-sky-200 text-sky-700';
      case 'Mascotas':
        return 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700';
      case 'Clientes':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'Facturación':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'Consultas':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'Horarios':
      case 'Empleados':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  }
}
