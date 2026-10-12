import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetodoPago } from '../../../../models/request/pago-request';
import { CitaResponse } from '../../../../models/response/cita-response';

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-dialog.component.html'
})
export class PaymentDialogComponent {
  readonly cita = input.required<CitaResponse>();
  readonly total = input.required<number>();
  readonly method = input.required<MetodoPago>();
  readonly receivedAmount = input<number | null>(null);
  readonly cashBills = input.required<readonly number[]>();
  readonly change = input(0);
  readonly outstandingBalance = input(0);
  readonly validPayment = input(false);
  readonly phone = input('');
  readonly otp = input('');
  readonly email = input('');
  readonly processing = input(false);

  readonly closed = output<void>();
  readonly confirmed = output<void>();
  readonly methodChanged = output<MetodoPago>();
  readonly receivedAmountChanged = output<number | null>();
  readonly phoneChanged = output<string>();
  readonly otpChanged = output<string>();
  readonly emailChanged = output<string>();
}
