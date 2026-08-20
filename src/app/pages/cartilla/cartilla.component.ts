import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CartillaService } from '../../core/services/cartilla.service';
import { MascotaService } from '../../core/services/mascota.service';
import { ServicioService } from '../../core/services/servicio.service';
import { MascotaResponse } from '../../models/response/mascota-response';
import { ServicioResponse } from '../../models/response/servicio-response';
import { AplicacionPreventiva, TipoVacuna, CartillaAplicacionResponse } from '../../models/cartilla.model';

@Component({
  selector: 'app-cartilla',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './cartilla.component.html',
  styleUrls: ['./cartilla.component.scss']
})
export class CartillaComponent implements OnInit {
  private readonly cartillaService = inject(CartillaService);
  private readonly mascotaService   = inject(MascotaService);
  private readonly servicioService  = inject(ServicioService);
  private readonly msgService       = inject(MessageService);

  readonly modo = signal<'VACUNACION' | 'DESPARASITACION'>('VACUNACION');

  // Búsqueda / selección de mascota
  searchQuery   = '';
  resultados    = signal<MascotaResponse[]>([]);
  mascotaSel    = signal<MascotaResponse | null>(null);
  buscando      = signal(false);

  // Alta rápida de mascota
  mostrarAlta   = signal(false);
  nuevoNombre   = '';
  nuevaEspecie  = '';
  nuevoSexo     = '';
  nuevaFechaNac = '';
  nuevoApoderadoId: number | null = null;

  // Aplicación
  serviciosPreventivos = signal<ServicioResponse[]>([]);
  servicioId: number | null = null;
  tipoVacunaId: number | null = null;
  tiposVacuna = signal<TipoVacuna[]>([]);
  producto    = '';
  fechaAplicacion = '';
  periodicidadMeses = 3;
  fechaProxima = '';

  // Resultado
  resultado = signal<CartillaAplicacionResponse | null>(null);
  matriz    = signal<AplicacionPreventiva[]>([]);
  guardando = signal(false);

  readonly tipoConfig = computed(() =>
    this.modo() === 'VACUNACION'
      ? { titulo: 'Cartilla de Vacunación', check: 'vacuna' }
      : { titulo: 'Cartilla de Desparasitación', check: 'desparasitación' }
  );

  ngOnInit() {
    this.cargarServiciosPreventivos();
  }

  private cargarServiciosPreventivos() {
    this.servicioService.listarDisponibles().subscribe({
      next: (res) =>
        this.serviciosPreventivos.set(
          (res.data ?? []).filter((s) => s.tipoControlPreventivo && s.tipoControlPreventivo !== 'NO_APLICA')
        ),
      error: () => this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los servicios preventivos' })
    });
  }

  buscar() {
    const q = this.searchQuery?.trim();
    if (!q) return;
    this.buscando.set(true);
    this.mascotaService.listar(undefined, q, undefined, 0, 20, true, true).subscribe({
      next: (res) => this.resultados.set((res.data?.content ?? [])),
      error: () => this.resultados.set([]),
      complete: () => this.buscando.set(false)
    });
  }

  seleccionarMascota(m: MascotaResponse) {
    this.mascotaSel.set(m);
    this.resultados.set([]);
    this.searchQuery = m.nombreCompleto;
    if (this.modo() === 'VACUNACION') {
      this.cargarTiposVacuna(m.id);
    }
  }

  private cargarTiposVacuna(petId: number) {
    this.cartillaService.listarTiposVacuna(petId).subscribe({
      next: (res) => this.tiposVacuna.set(res.data ?? []),
      error: () => this.msgService.add({ severity: 'warn', summary: 'Aviso', detail: 'No se pudieron cargar los tipos de vacuna' })
    });
  }

  cambiarModo(modo: 'VACUNACION' | 'DESPARASITACION') {
    this.modo.set(modo);
    this.resultado.set(null);
    const m = this.mascotaSel();
    if (modo === 'VACUNACION' && m) this.cargarTiposVacuna(m.id);
  }

  registrarNuevaMascota() {
    if (!this.nuevoNombre?.trim() || !this.nuevaEspecie || !this.nuevoApoderadoId) {
      this.msgService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Nombre, especie y apoderado son obligatorios' });
      return;
    }
    this.mascotaService.crear({
      nombreCompleto: this.nuevoNombre.trim(),
      especie: this.nuevaEspecie,
      sexo: this.nuevoSexo || 'MACHO',
      fechaNacimiento: this.nuevaFechaNac || new Date().toISOString().slice(0, 10),
      apoderadoId: this.nuevoApoderadoId,
      razaId: 0
    }).subscribe({
      next: (res) => {
        this.mascotaSel.set(res.data);
        this.mostrarAlta.set(false);
        if (this.modo() === 'VACUNACION') this.cargarTiposVacuna(res.data.id);
        this.msgService.add({ severity: 'success', summary: 'Mascota registrada', detail: res.data.nombreCompleto });
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar la mascota' })
    });
  }

  guardar() {
    const m = this.mascotaSel();
    if (!m) { this.msgService.add({ severity: 'warn', summary: 'Falta mascota', detail: 'Seleccione o registre la mascota' }); return; }
    if (!this.servicioId) { this.msgService.add({ severity: 'warn', summary: 'Falta servicio', detail: 'Seleccione el servicio preventivo' }); return; }
    if (this.modo() === 'VACUNACION' && !this.tipoVacunaId) { this.msgService.add({ severity: 'warn', summary: 'Falta vacuna', detail: 'Seleccione la vacuna' }); return; }
    if (this.modo() === 'DESPARASITACION' && !this.producto?.trim()) { this.msgService.add({ severity: 'warn', summary: 'Falta producto', detail: 'Indique el producto' }); return; }
    if (!this.fechaAplicacion) { this.msgService.add({ severity: 'warn', summary: 'Falta fecha', detail: 'Indique la fecha de aplicación' }); return; }

    const req = {
      mascotaId: m.id,
      servicioId: this.servicioId,
      fechaAplicacion: this.fechaAplicacion,
      periodicidadMeses: this.periodicidadMeses,
      fechaProxima: this.fechaProxima || undefined,
      ...(this.modo() === 'VACUNACION' ? { tipoVacunaId: this.tipoVacunaId! } : { producto: this.producto.trim() })
    };

    this.guardando.set(true);
    const call = this.modo() === 'VACUNACION'
      ? this.cartillaService.registrarVacunacion(req)
      : this.cartillaService.registrarDesparasitacion(req);

    call.subscribe({
      next: (res) => {
        this.resultado.set(res.data);
        this.msgService.add({ severity: 'success', summary: 'Registrado', detail: `Cobro generado: ${res.data.codigoCobro} (S/ ${res.data.total})` });
        this.cargarMatriz(m.id);
      },
      error: (err) => this.msgService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar' }),
      complete: () => this.guardando.set(false)
    });
  }

  private cargarMatriz(petId: number) {
    this.cartillaService.obtenerMatriz(petId).subscribe({
      next: (res) => this.matriz.set(res.data ?? []),
      error: () => this.matriz.set([])
    });
  }

  limpiar() {
    this.mascotaSel.set(null);
    this.resultado.set(null);
    this.matriz.set([]);
    this.searchQuery = '';
    this.servicioId = null;
    this.tipoVacunaId = null;
    this.producto = '';
    this.fechaAplicacion = '';
    this.fechaProxima = '';
  }
}