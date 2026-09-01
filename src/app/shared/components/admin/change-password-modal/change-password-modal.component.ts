import { Component, EventEmitter, Output, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsuarioService } from '../../../../core/services/usuario.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ToastModule],
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
  providers: [MessageService]
})
export class ChangePasswordModalComponent {
  private readonly usuarioService = inject(UsuarioService);
  private readonly messageService = inject(MessageService);

  userId = input.required<number>();
  userName = input.required<string>();
  
  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  loading = signal(false);

  onSubmit() {
    this.loading.set(true);
    this.usuarioService.requestPasswordReset(this.userId()).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Se enviaron instrucciones seguras al correo del usuario'
        });
        setTimeout(() => {
          this.loading.set(false);
          this.onConfirm.emit();
        }, 1500);
      },
      error: (err) => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'No se pudieron enviar las instrucciones'
        });
      }
    });
  }

  close() {
    this.onClose.emit();
  }
}
