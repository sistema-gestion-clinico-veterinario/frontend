import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DerechosDatosService } from '../../core/services/derechos-datos.service';
import { SolicitudDerechoDatos, TipoDerechoDatos } from '../../models/privacy/derechos-datos.model';

@Component({
  selector: 'app-derechos-datos', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <main class="min-h-screen bg-slate-50 p-4 sm:p-6"><div class="mx-auto max-w-5xl space-y-5">
    <header><a routerLink="/profile" class="text-sm font-bold text-[var(--brand-primary)]">← Volver al perfil</a>
      <h1 class="mt-2 text-2xl font-extrabold text-slate-900">Mis derechos sobre datos personales</h1>
      <p class="mt-1 text-sm text-slate-600">Solicita acceso, rectificación, oposición o portabilidad y consulta el seguimiento. La cancelación conserva su proceso reforzado de verificación.</p>
    </header>
    @if (mensaje()) { <p class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{{ mensaje() }}</p> }
    @if (error()) { <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{{ error() }}</p> }
    <section class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="font-extrabold text-slate-800">Nueva solicitud</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <label class="text-xs font-bold text-slate-600">Derecho<select [(ngModel)]="tipo" class="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal">
          <option value="ACCESO">Acceso</option><option value="RECTIFICACION">Rectificación</option><option value="OPOSICION">Oposición</option><option value="PORTABILIDAD">Portabilidad</option>
        </select></label>
        <div class="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{{ ayuda() }}</div>
      </div>
      <label class="mt-4 block text-xs font-bold text-slate-600">Detalle de la solicitud<textarea [(ngModel)]="descripcion" maxlength="4000" rows="4" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal"></textarea></label>
      @if (tipo === 'RECTIFICACION') { <label class="mt-4 block text-xs font-bold text-slate-600">Dato actual y corrección solicitada<textarea [(ngModel)]="datoRectificar" maxlength="4000" rows="3" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal"></textarea></label> }
      <div class="mt-4 flex flex-wrap justify-between gap-2"><a routerLink="/profile" fragment="cancelacion-datos" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Solicitar cancelación</a>
        <button (click)="crear()" [disabled]="guardando() || descripcion.trim().length < 10" class="rounded-lg bg-[var(--brand-primary)] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{{ guardando() ? 'Registrando…' : 'Registrar solicitud' }}</button></div>
    </section>
    <section class="rounded-xl border border-slate-200 bg-white p-5"><h2 class="font-extrabold text-slate-800">Seguimiento</h2>
      @if (cargando()) { <p class="mt-4 text-sm text-slate-500">Cargando…</p> }
      @for (s of solicitudes(); track s.id) { <article class="mt-4 rounded-lg border border-slate-200 p-4">
        <div class="flex flex-wrap justify-between gap-2"><strong class="text-sm text-slate-800">{{ s.tipo }} · solicitud {{ s.id }}</strong><span class="text-xs font-bold" [class.text-rose-600]="s.vencida">{{ s.estado }}{{ s.vencida ? ' · plazo vencido' : '' }}</span></div>
        <p class="mt-2 text-sm text-slate-600">{{ s.descripcion }}</p><p class="mt-2 text-xs text-slate-500">Registrada: {{ s.creadaAt | date:'dd/MM/yyyy HH:mm' }} · Fecha límite operativa: {{ s.fechaLimite | date:'dd/MM/yyyy' }}</p>
        @if (s.respuesta) { <p class="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Respuesta:</strong> {{ s.respuesta }}</p> }
        @if (s.motivoRechazo) { <p class="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><strong>Fundamento:</strong> {{ s.motivoRechazo }}</p> }
      </article> } @empty { @if (!cargando()) { <p class="mt-4 text-sm text-slate-500">Aún no tienes solicitudes.</p> } }
    </section>
  </div></main>`
})
export class DerechosDatosComponent implements OnInit {
  private readonly service = inject(DerechosDatosService);
  readonly solicitudes = signal<SolicitudDerechoDatos[]>([]); readonly cargando = signal(true); readonly guardando = signal(false);
  readonly error = signal(''); readonly mensaje = signal('');
  tipo: TipoDerechoDatos = 'ACCESO'; descripcion = ''; datoRectificar = '';
  ngOnInit(): void { this.cargar(); }
  ayuda(): string { return { ACCESO: 'Conoce qué datos conserva la clínica y cómo los trata.', RECTIFICACION: 'Corrige datos inexactos o desactualizados.', OPOSICION: 'Solicita que un tratamiento específico deje de realizarse.', PORTABILIDAD: 'Solicita tus datos en un formato estructurado cuando corresponda.' }[this.tipo]; }
  cargar(): void { this.cargando.set(true); this.service.listarMias().subscribe({ next: r => { this.solicitudes.set(r.data ?? []); this.cargando.set(false); }, error: e => { this.error.set(e.error?.message ?? 'No se pudo cargar.'); this.cargando.set(false); } }); }
  crear(): void { if (this.tipo === 'RECTIFICACION' && this.datoRectificar.trim().length < 3) { this.error.set('Indica el dato y la corrección solicitada.'); return; } this.guardando.set(true); this.error.set(''); this.service.crear(this.tipo, this.descripcion.trim(), this.datoRectificar.trim() || null).subscribe({ next: () => { this.guardando.set(false); this.descripcion = ''; this.datoRectificar = ''; this.mensaje.set('Solicitud registrada correctamente.'); this.cargar(); }, error: e => { this.guardando.set(false); this.error.set(e.error?.message ?? 'No se pudo registrar.'); } }); }
}
