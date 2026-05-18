import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProfileService } from '../../../core/services/profile.service';
import { HorarioEmpleadoResponse } from '../../../models/response/horario-empleado-response';
import { ApiResponse } from '../../../models/response/api-response';
import { ProfileResponse } from '../../../models/response/profile-response';

@Component({
  selector: 'app-my-schedule',
  standalone: true,
  imports: [CommonModule, ToastModule],
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

  ngOnInit() {
    this.loadMyProfile();
  }

  loadMyProfile() {
    this.loading = true;
    this.profileService.getProfile().subscribe({
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

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: any[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, otherMonth: true });
    }

    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const isToday = date.toDateString() === today.toDateString();
      const dayShifts = this.horarios.filter(h => new Date(h.fecha).toDateString() === date.toDateString());
      days.push({ day: i, otherMonth: false, isToday, shifts: dayShifts });
    }

    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      days.push({ day: i, otherMonth: true });
    }
    this.calendarDays = days;
  }

  prevMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateCalendar();
  }
}
