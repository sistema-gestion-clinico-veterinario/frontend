import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProfileService } from '../../../core/services/profile.service';
import { HorarioEmpleadoResponse } from '../../../models/response/horario-empleado-response';
import { ApiResponse } from '../../../models/response/api-response';
import { ProfileResponse } from '../../../models/response/profile-response';

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, Toast],
  providers: [MessageService],
  templateUrl: './my-schedule.component.html',
  styleUrl: './my-schedule.component.scss'
})
export class MyScheduleComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly messageService = inject(MessageService);

  horarios: HorarioEmpleadoResponse[] = [];
  loading: boolean = false;
  currentDate = new Date();
  calendarDays: any[] = [];
  monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  viewMode: 'day' | 'week' | 'month' = 'month';

  ngOnInit() {
    this.loadMyProfile();
  }

  loadMyProfile() {
    this.loading = true;
    this.profileService.getMySchedule().subscribe({
      next: (res: ApiResponse<ProfileResponse>) => {
        this.horarios = res.data.horarios || [];
        this.generateCalendar();
        this.loading = false;
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar su perfil' });
        this.loading = false;
      }
    });
  }

  changeView(mode: 'day' | 'week' | 'month') {
    this.viewMode = mode;
    this.generateCalendar();
  }

  generateCalendar() {
    this.calendarDays = [];
    const today = new Date();
    
    if (this.viewMode === 'month') {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startPadding = firstDay.getDay();

      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = startPadding - 1; i >= 0; i--) {
        this.calendarDays.push({ day: prevMonthLastDay - i, otherMonth: true, date: new Date(year, month - 1, prevMonthLastDay - i) });
      }

      for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(year, month, i);
        const isToday = date.toDateString() === today.toDateString();
        const dayShifts = this.horarios.filter(h => new Date(h.fecha).toDateString() === date.toDateString());
        this.calendarDays.push({ day: i, otherMonth: false, isToday, shifts: dayShifts, date: date });
      }

      const remainingSlots = 42 - this.calendarDays.length;
      for (let i = 1; i <= remainingSlots; i++) {
        this.calendarDays.push({ day: i, otherMonth: true, date: new Date(year, month + 1, i) });
      }
    } else if (this.viewMode === 'week') {
      const startOfWeek = new Date(this.currentDate);
      startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const isToday = d.toDateString() === today.toDateString();
        const dayShifts = this.horarios.filter(h => new Date(h.fecha).toDateString() === d.toDateString());
        this.calendarDays.push({ day: d.getDate(), otherMonth: d.getMonth() !== this.currentDate.getMonth(), isToday, shifts: dayShifts, date: d });
      }
    } else if (this.viewMode === 'day') {
      const d = new Date(this.currentDate);
      const isToday = d.toDateString() === today.toDateString();
      const dayShifts = this.horarios.filter(h => new Date(h.fecha).toDateString() === d.toDateString());
      this.calendarDays.push({ day: d.getDate(), otherMonth: false, isToday, shifts: dayShifts, date: d });
    }
  }

  prev() {
    if (this.viewMode === 'month') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    } else if (this.viewMode === 'week') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate() - 7);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate() - 1);
    }
    this.generateCalendar();
  }

  next() {
    if (this.viewMode === 'month') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    } else if (this.viewMode === 'week') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate() + 7);
    } else {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate() + 1);
    }
    this.generateCalendar();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateCalendar();
  }

  // --- LOGIC PARA EXPORTACIÓN ---

  get authStore(): any {
    // We can extract user details from ProfileService or assuming we have name/role
    // We'll just grab it from local profile response if we save it
    return (this as any)._profileData || { nombre: 'Empleado', cargo: 'Personal' };
  }

  calculateTotalHours(shifts: any[]): number {
    let total = 0;
    shifts.forEach(s => {
      if (s.horaInicio && s.horaFin) {
        const [h1, m1] = s.horaInicio.split(':').map(Number);
        const [h2, m2] = s.horaFin.split(':').map(Number);
        const diff = (h2 + m2 / 60) - (h1 + m1 / 60);
        if (diff > 0) total += diff;
      }
    });
    return Math.round(total * 100) / 100;
  }

  get totalShiftsHours() {
    return this.calculateTotalHours(this.horarios);
  }

  get printableWeeks() {
    const allShifts = this.horarios;
    const datedShifts = allShifts.filter((s: any) => s.fecha);
    const baseShifts = allShifts.filter((s: any) => !s.fecha);

    const weeksMap = new Map<string, any[]>();
    datedShifts.forEach((s: any) => {
      const d = new Date(s.fecha + 'T00:00:00');
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const mondayStr = monday.toISOString().split('T')[0];
      
      if (!weeksMap.has(mondayStr)) {
        weeksMap.set(mondayStr, []);
      }
      weeksMap.get(mondayStr)?.push(s);
    });

    const sortedWeekKeys = Array.from(weeksMap.keys()).sort();
    const list: any[] = [];
    const dayNames = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

    if (baseShifts.length > 0) {
      const days: any[] = [];
      dayNames.forEach(name => {
        const dayShifts = baseShifts.filter((s: any) => s.diaSemana === name);
        days.push({
          name,
          shifts: dayShifts.map((s: any) => ({
            timeRange: `${s.horaInicio?.substring(0,5)} - ${s.horaFin?.substring(0,5)}`,
            duration: this.calculateTotalHours([s])
          }))
        });
      });
      list.push({
        isBase: true,
        title: 'Base Semanal',
        subtitle: 'Plantilla Fija',
        days
      });
    }

    sortedWeekKeys.forEach(mondayStr => {
      const mondayDate = new Date(mondayStr + 'T00:00:00');
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(mondayDate.getDate() + 6);
      
      const weekShifts = weeksMap.get(mondayStr) || [];
      const days: any[] = [];
      
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(mondayDate);
        currentDay.setDate(mondayDate.getDate() + i);
        const currentDayStr = currentDay.toISOString().split('T')[0];
        
        const dayShifts = weekShifts.filter((s: any) => s.fecha === currentDayStr);
        days.push({
          name: dayNames[i],
          shifts: dayShifts.map((s: any) => ({
            timeRange: `${s.horaInicio?.substring(0,5)} - ${s.horaFin?.substring(0,5)}`,
            duration: this.calculateTotalHours([s])
          }))
        });
      }

      list.push({
        isBase: false,
        title: 'Semana',
        subtitle: `${mondayDate.toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit'})} al ${sundayDate.toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit'})}`,
        days
      });
    });

    return list;
  }

  get currentDateFormatted() {
    return new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  exportPdf() {
    const empName = this.authStore.nombre || 'Personal';

    this.messageService.add({ severity: 'success', summary: 'Generando Reporte', detail: `Preparando PDF de tu horario...` });
    
    const printContent = document.getElementById('print-area');
    if (!printContent) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se encontró el contenedor de impresión' });
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Mi Horario de Trabajo</title>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap">
            <style>
              body { font-family: 'Outfit', sans-serif; color: #0f172a; padding: 40px; -webkit-print-color-adjust: exact; }
              .print-header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
              .print-logo-title { display: flex; flex-direction: column; }
              .print-logo-text { font-size: 26px; font-weight: 800; line-height: 1; }
              .print-subtitle { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
              .print-report-info { text-align: right; font-size: 11px; color: #475569; line-height: 1.5; }
              .print-employee-card { background: #ffffff; border: 1px solid #0f172a; padding: 16px 20px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
              .print-card-field { display: flex; flex-direction: column; }
              .print-field-label { font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px; }
              .print-field-value { font-size: 14px; font-weight: 600; }
              .print-highlight-value { color: #000; font-size: 16px; font-weight: 800; }
              .print-matrix-table-container { border: 1px solid #0f172a; margin-bottom: 30px; }
              .print-table { width: 100%; border-collapse: collapse; }
              .print-table th { background: #f8fafc !important; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 12px; border: 1px solid #0f172a; }
              .print-table td { border: 1px solid #0f172a; padding: 8px; text-align: center; font-size: 11px; }
              .print-week-cell { background: #f8fafc !important; text-align: left; width: 130px; font-weight: 800; padding-left: 12px; }
              .print-week-dates { font-size: 10px; color: #475569; font-weight: 700; }
              .print-week-dates-sub { font-size: 9px; color: #64748b; }
              .print-empty-cell { color: #cbd5e1; font-size: 12px; }
              .print-matrix-shift-box { background: #ffffff !important; border: 1px solid #0f172a !important; padding: 6px; text-align: center; display: inline-block; width: 100%; box-sizing: border-box; }
              .print-time-range { font-size: 10px; font-weight: 800; color: #000; }
              .print-duration-tag { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #475569; margin-top: 2px; }
              .print-empty-state-row { padding: 30px; text-align: center; color: #64748b; font-size: 12px; }
              .print-footer-notes { margin-top: 50px; border-top: 1px solid #0f172a; padding-top: 20px; font-size: 10px; color: #64748b; text-align: center; line-height: 1.6; }
              @media print { body { padding: 10px; } }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 500);
    }
  }

  async exportExcel() {
    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const empName = this.authStore.nombre || 'Personal';
      const cargo   = this.authStore.cargo || 'Personal';

      this.messageService.add({ severity: 'success', summary: 'Generando Reporte', detail: `Preparando Excel de tu horario...` });

      const dateStr  = new Date().toLocaleDateString('es-PE');
      const totalHrs = this.totalShiftsHours;
      const weeks    = this.printableWeeks;
      const days     = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

      const headerFill  = (hex: string): any => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
      const thinBorder  = (): any => ({ top: { style: 'thin', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FF94A3B8' } }, bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }, right: { style: 'thin', color: { argb: 'FF94A3B8' } } });
      const gridBorder  = (): any => ({ top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } });
      const darkBorder  = (): any => ({ top: { style: 'thin', color: { argb: 'FF1E293B' } }, left: { style: 'thin', color: { argb: 'FF1E293B' } }, bottom: { style: 'thin', color: { argb: 'FF1E293B' } }, right: { style: 'thin', color: { argb: 'FF1E293B' } } });

      const workbook  = new ExcelJS.Workbook();
      workbook.creator = 'VargasVet Sistema';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet(`Mi Horario`, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });

      sheet.columns = [
        { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
      ];

      sheet.mergeCells('A1:H1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'VARGASVET — MI HORARIO DE TRABAJO';
      titleCell.font  = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FF0F172A' } };
      titleCell.fill  = headerFill('FFF8FAFC');
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      titleCell.border = { bottom: { style: 'medium', color: { argb: 'FF0F172A' } } };
      sheet.getRow(1).height = 32;

      sheet.getRow(2).height = 8;

      const metaRows: [string, string, string, string][] = [
        ['Colaborador', empName,   'Fecha de Emisión',        dateStr       ],
        ['Cargo / Función', cargo, 'Total Horas Registradas', `${totalHrs} hrs`],
      ];
      metaRows.forEach((meta, i) => {
        const rowIdx = 3 + i;
        const row = sheet.getRow(rowIdx);
        row.height = 22;

        const labelA = sheet.getCell(`A${rowIdx}`);
        labelA.value = meta[0];
        labelA.font  = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1E293B' } };
        labelA.fill  = headerFill('FFF1F5F9');
        labelA.border = thinBorder();
        labelA.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        sheet.mergeCells(`B${rowIdx}:D${rowIdx}`);
        const valueA = sheet.getCell(`B${rowIdx}`);
        valueA.value = meta[1];
        valueA.font  = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
        valueA.border = thinBorder();
        valueA.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        const labelB = sheet.getCell(`E${rowIdx}`);
        labelB.value = meta[2];
        labelB.font  = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1E293B' } };
        labelB.fill  = headerFill('FFF1F5F9');
        labelB.border = thinBorder();
        labelB.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        sheet.mergeCells(`F${rowIdx}:H${rowIdx}`);
        const valueB = sheet.getCell(`F${rowIdx}`);
        valueB.value = meta[3];
        valueB.font  = i === 1 ? { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF0F172A' } } : { name: 'Calibri', size: 10,   color: { argb: 'FF0F172A' } };
        valueB.fill  = i === 1 ? headerFill('FFE2E8F0') : headerFill('FFFFFFFF');
        valueB.border = thinBorder();
        valueB.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      });

      sheet.getRow(5).height = 12;

      const hdrRow = sheet.getRow(6);
      hdrRow.height = 28;
      ['Periodo / Semana', ...days].forEach((label, col) => {
        const cell = hdrRow.getCell(col + 1);
        cell.value = label.toUpperCase();
        cell.font  = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cell.fill  = headerFill(col === 0 ? 'FF0F172A' : 'FF1E293B');
        cell.border = darkBorder();
        cell.alignment = { horizontal: col === 0 ? 'left' : 'center', vertical: 'middle', indent: col === 0 ? 1 : 0 };
      });

      let currentRow = 7;
      if (weeks.length === 0) {
        sheet.mergeCells(`A${currentRow}:H${currentRow}`);
        const emptyCell = sheet.getCell(`A${currentRow}`);
        emptyCell.value = 'No tienes turnos planificados asignados.';
        emptyCell.font  = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF64748B' } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        emptyCell.border = gridBorder();
        sheet.getRow(currentRow).height = 28;
      } else {
        weeks.forEach((week: any, idx: number) => {
          const row  = sheet.getRow(currentRow);
          row.height = 40;
          const altBg = idx % 2 === 1 ? 'FFF1F5F9' : 'FFFFFFFF';

          const weekCell = row.getCell(1);
          weekCell.value = { richText: [
            { text: week.title + '\n', font: { name: 'Calibri', bold: true,   size: 9, color: { argb: 'FF0F172A' } } },
            { text: week.subtitle,     font: { name: 'Calibri', bold: false,  size: 8, color: { argb: 'FF475569' } } },
          ]};
          weekCell.fill  = headerFill('FFF8FAFC');
          weekCell.border = gridBorder();
          weekCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };

          week.days.forEach((day: any, d: number) => {
            const cell = row.getCell(d + 2);
            cell.border = gridBorder();
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            if (day.shifts && day.shifts.length > 0) {
              const lines = day.shifts.map((s: any) => `${s.timeRange}  (${s.duration}h)`).join('\n');
              cell.value = lines;
              cell.font  = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FF0F172A' } };
              cell.fill  = headerFill(idx % 2 === 1 ? 'FFE0F2FE' : 'FFF0F9FF');
            } else {
              cell.value = '–';
              cell.font  = { name: 'Calibri', size: 11, color: { argb: 'FFCBD5E1' } };
              cell.fill  = headerFill(altBg);
            }
          });
          currentRow++;
        });
      }

      currentRow++;
      sheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const footerCell = sheet.getCell(`A${currentRow}`);
      footerCell.value = `Este horario representa tus turnos vigentes programados. — Emitido el ${dateStr}`;
      footerCell.font  = { name: 'Calibri', italic: true, size: 8, color: { argb: 'FF94A3B8' } };
      footerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      footerCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      sheet.getRow(currentRow).height = 28;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link   = document.createElement('a');
      link.href    = URL.createObjectURL(blob);
      link.download = `Mi_Horario_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Hubo un error generando el Excel.' });
    }
  }
}
