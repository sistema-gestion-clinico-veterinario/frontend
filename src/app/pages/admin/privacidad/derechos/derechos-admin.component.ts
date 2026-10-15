import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DerechosDatosService } from '../../../../core/services/derechos-datos.service';
import { EstadoSolicitudDerecho, SolicitudDerechoDatos } from '../../../../models/privacy/derechos-datos.model';

@Component({ selector: 'app-derechos-admin', standalone: true, imports: [CommonModule, FormsModule, RouterLink], template: `
<main class="min-h-screen bg-slate-50 p-4 sm:p-6"><div class="mx-auto max-w-6xl space-y-5">
<header><a routerLink="/admin/privacidad" class="text-sm font-bold text-[var(--brand-primary)]">← Privacidad</a><h1 class="mt-2 text-2xl font-extrabold">Solicitudes de derechos de datos</h1><p class="text-sm text-slate-600">Acceso, rectificación, oposición y portabilidad. La cancelación se administra en su módulo especializado.</p></header>
@if (error()) { <p class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ error() }}</p> }
@for (s of solicitudes(); track s.id) { <article class="rounded-xl border border-slate-200 bg-white p-5"><div class="flex flex-wrap justify-between gap-2"><div><strong>{{ s.tipo }} · {{ s.titular }}</strong><p class="text-xs text-slate-500">{{ s.correoTitular }} · límite {{ s.fechaLimite | date:'dd/MM/yyyy' }}</p></div><span class="text-xs font-bold" [class.text-rose-600]="s.vencida">{{ s.estado }}{{ s.vencida ? ' · VENCIDA' : '' }}</span></div><p class="mt-3 text-sm text-slate-700">{{ s.descripcion }}</p>@if (s.datoRectificar) { <p class="mt-2 rounded bg-slate-50 p-2 text-sm"><strong>Rectificación:</strong> {{ s.datoRectificar }}</p> }
@if (s.estado !== 'ATENDIDA' && s.estado !== 'RECHAZADA') { <div class="mt-4 grid gap-3 md:grid-cols-[180px_1fr]"><select [(ngModel)]="estados[s.id]" class="h-10 rounded-lg border border-slate-300 px-2 text-sm"><option value="EN_REVISION">En revisión</option><option value="REQUIERE_INFORMACION">Requiere información</option><option value="ATENDIDA">Atendida</option><option value="RECHAZADA">Rechazada</option></select><textarea [(ngModel)]="textos[s.id]" rows="2" placeholder="Respuesta al titular o fundamento del rechazo" class="rounded-lg border border-slate-300 p-2 text-sm"></textarea></div><div class="mt-2 text-right"><button (click)="resolver(s)" [disabled]="trabajando()" class="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Guardar actuación</button></div> }
@if (s.respuesta) { <p class="mt-3 rounded bg-emerald-50 p-3 text-sm text-emerald-800"><strong>Respuesta:</strong> {{ s.respuesta }}</p> } @if (s.motivoRechazo) { <p class="mt-3 rounded bg-rose-50 p-3 text-sm text-rose-700"><strong>Fundamento:</strong> {{ s.motivoRechazo }}</p> }
</article> } @empty { <p class="rounded-xl border bg-white p-5 text-sm text-slate-500">No hay solicitudes.</p> }
</div></main>` })
export class DerechosAdminComponent implements OnInit {
 private readonly service = inject(DerechosDatosService); readonly solicitudes = signal<SolicitudDerechoDatos[]>([]); readonly error = signal(''); readonly trabajando = signal(false);
 estados: Record<number, EstadoSolicitudDerecho> = {}; textos: Record<number, string> = {};
 ngOnInit(): void { this.cargar(); }
 cargar(): void { this.service.listar().subscribe({ next: r => { this.solicitudes.set(r.data ?? []); for (const s of r.data ?? []) this.estados[s.id] = s.estado === 'RECIBIDA' ? 'EN_REVISION' : s.estado; }, error: e => this.error.set(e.error?.message ?? 'No se pudo cargar.') }); }
 resolver(s: SolicitudDerechoDatos): void { const estado = this.estados[s.id]; const texto = (this.textos[s.id] ?? '').trim(); this.trabajando.set(true); this.service.actualizar(s.id, estado, estado === 'RECHAZADA' ? null : texto, estado === 'RECHAZADA' ? texto : null).subscribe({ next: () => { this.trabajando.set(false); this.cargar(); }, error: e => { this.trabajando.set(false); this.error.set(e.error?.message ?? 'No se pudo actualizar.'); } }); }
}
