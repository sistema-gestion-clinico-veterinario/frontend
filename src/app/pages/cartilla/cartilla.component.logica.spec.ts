import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { CartillaComponent } from './cartilla.component';
import { CartillaService } from '../../core/services/cartilla.service';
import { ControlPreventivoService } from '../../core/services/control-preventivo.service';
import { MascotaService } from '../../core/services/mascota.service';
import { ServicioService } from '../../core/services/servicio.service';
import { AuthStore } from '../../store/auth.store';

describe('CartillaComponent - reglas de uso', () => {
  let cartilla: jasmine.SpyObj<CartillaService>;
  let preventivo: jasmine.SpyObj<ControlPreventivoService>;
  let mascotas: jasmine.SpyObj<MascotaService>;
  let servicios: jasmine.SpyObj<ServicioService>;
  let aviso: jasmine.Spy;

  const luna = { id: 20, nombreCompleto: 'Luna', especie: 'PERRO' } as any;
  const servicioVacuna = { id: 5, nombre: 'Vacunación', tipoControlPreventivo: 'VACUNACION' } as any;
  const control = (extra: object = {}) => ({
    id: 70, tipo: 'VACUNACION', tipoVacunaId: 50, nombreControl: 'Rabia', estado: 'PENDIENTE',
    fechaRecomendada: '2026-11-15', ...extra
  }) as any;

  function crear(authStore: object = {
    selectedEnterprise: () => ({ establishmentId: 7, name: 'Clínica Patitas' }),
    companyId: () => 7,
    companyName: () => 'Clínica Patitas',
    isSuperAdmin: () => false
  }) {
    cartilla = jasmine.createSpyObj('CartillaService', [
      'listarMascotasConCartilla', 'obtenerDetalle', 'obtenerMatriz', 'registrarVacunacion',
      'registrarDesparasitacion', 'cambiarEstadoVacunacion', 'cambiarEstadoDesparasitacion'
    ]);
    cartilla.listarMascotasConCartilla.and.returnValue(of({ data: { content: [], totalPages: 0, totalElements: 0 } } as any));
    cartilla.obtenerDetalle.and.returnValue(of({ data: { vacunas: [], desparasitantes: [], controles: [], aplicaciones: [] } } as any));
    cartilla.obtenerMatriz.and.returnValue(of({ data: [] } as any));
    preventivo = jasmine.createSpyObj('ControlPreventivoService', ['listarControles', 'programar', 'reprogramar', 'cancelar', 'listarTiposVacuna']);
    mascotas = jasmine.createSpyObj('MascotaService', ['listar', 'obtenerPorId']);
    servicios = jasmine.createSpyObj('ServicioService', ['listarDisponibles']);
    servicios.listarDisponibles.and.returnValue(of({ data: [servicioVacuna, { id: 6, tipoControlPreventivo: 'NO_APLICA' }] } as any));

    TestBed.configureTestingModule({
      imports: [CartillaComponent],
      providers: [
        { provide: CartillaService, useValue: cartilla },
        { provide: ControlPreventivoService, useValue: preventivo },
        { provide: MascotaService, useValue: mascotas },
        { provide: ServicioService, useValue: servicios },
        { provide: AuthStore, useValue: authStore },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } }
      ]
    });
    const fixture = TestBed.createComponent(CartillaComponent);
    aviso = spyOn(fixture.debugElement.injector.get(MessageService), 'add');
    return fixture.componentInstance;
  }

  describe('al preparar una aplicación desde un control pendiente', () => {
    it('toma la vacuna del control, la periodicidad sugerida y el único servicio de cobro', () => {
      const c = crear();
      c.serviciosPreventivos.set([servicioVacuna]);
      c.tiposVacuna.set([{ id: 50, nombre: 'Rabia', periodicidadMesesSugerida: 6 } as any]);

      c.prepararAplicacion(control());

      expect(c.controlActivo()?.id).toBe(70);
      expect(c.modo()).toBe('VACUNACION');
      expect(c.tipoVacunaId).toBe(50);
      expect(c.intervaloCantidad).toBe(6);
      expect(c.intervaloUnidad).toBe('MESES');
      expect(c.servicioId).toBe(5);
      expect(c.fechaAplicacion).toBe(c.fechaHoyLima);
    });

    it('usa 12 meses si la vacuna no trae periodicidad y no elige servicio cuando hay varios', () => {
      const c = crear();
      c.serviciosPreventivos.set([servicioVacuna, { id: 8, tipoControlPreventivo: 'VACUNACION' } as any]);
      c.tiposVacuna.set([{ id: 50, nombre: 'Rabia' } as any]);

      c.prepararAplicacion(control());

      expect(c.intervaloCantidad).toBe(12);
      expect(c.servicioId).toBeNull();
    });

    it('para una desparasitación cambia de modo, no arrastra la vacuna y propone 3 meses', () => {
      const c = crear();
      c.tipoVacunaId = 50;

      c.prepararAplicacion(control({ tipo: 'DESPARASITACION', tipoVacunaId: undefined, nombreControl: 'Drontal' }));

      expect(c.modo()).toBe('DESPARASITACION');
      expect(c.tipoVacunaId).toBeNull();
      expect(c.tipoDesparasitanteId).toBeNull();
      expect(c.intervaloCantidad).toBe(3);
    });
  });

  describe('al elegir el producto', () => {
    it('propone la periodicidad, el lote y el vencimiento del catálogo', () => {
      const c = crear();
      c.tiposVacuna.set([{ id: 50, periodicidadMesesSugerida: 6, lote: 'NV2026A001', fechaVencimientoProducto: '2027-03-01' } as any]);

      c.actualizarIntervaloSugerido(50);

      expect(c.intervaloCantidad).toBe(6);
      expect(c.lote).toBe('NV2026A001');
      expect(c.fechaVencimientoProducto).toBe('2027-03-01');
    });

    it('sin selección no cambia nada y en desparasitación usa el catálogo de desparasitantes', () => {
      const c = crear();
      c.intervaloCantidad = 9;
      c.actualizarIntervaloSugerido(null);
      expect(c.intervaloCantidad).toBe(9);

      c.cambiarModo('DESPARASITACION');
      c.tiposDesparasitante.set([{ id: 3, periodicidadMesesSugerida: 2, lote: 'D-9' } as any]);
      c.actualizarIntervaloSugerido(3);
      expect(c.intervaloCantidad).toBe(2);
      expect(c.lote).toBe('D-9');
    });

    it('cambiar de modo restablece los intervalos de cada tipo y descarta el resultado anterior', () => {
      const c = crear();
      c.resultado.set({ registroId: 1 } as any);

      c.cambiarModo('DESPARASITACION');
      expect(c.intervaloCantidad).toBe(3);
      expect(c.resultado()).toBeNull();

      c.cambiarModo('VACUNACION');
      expect(c.intervaloCantidad).toBe(12);
    });
  });

  describe('al confirmar la aplicación', () => {
    function preparar(c: CartillaComponent) {
      c.mascotaSel.set(luna);
      c.serviciosPreventivos.set([servicioVacuna]);
      c.tipoVacunaId = 50;
      c.fechaAplicacion = '2026-10-19';
    }

    function noRegistro(c: CartillaComponent, resumen: string, detalle: string) {
      expect(cartilla.registrarVacunacion).not.toHaveBeenCalled();
      expect(cartilla.registrarDesparasitacion).not.toHaveBeenCalled();
      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn', summary: resumen, detail: detalle }));
      expect(c.guardando()).toBeFalse();
    }

    it('exige mascota, producto, fecha y unidad de la dosis antes de enviar', () => {
      const c = crear();
      c.guardar();
      noRegistro(c, 'Falta mascota', 'Seleccione o registre la mascota');

      preparar(c);
      c.tipoVacunaId = null;
      c.guardar();
      noRegistro(c, 'Falta vacuna', 'Seleccione la vacuna');

      c.tipoVacunaId = 50;
      c.fechaAplicacion = '';
      c.guardar();
      noRegistro(c, 'Falta fecha', 'Indique la fecha de aplicación');

      c.fechaAplicacion = '2026-10-19';
      c.dosis = 1;
      c.unidadDosis = '  ';
      c.guardar();
      noRegistro(c, 'Falta unidad', 'Indique la unidad de la dosis');
    });

    it('pide elegir el servicio cuando hay varios para cobrar', () => {
      const c = crear();
      preparar(c);
      c.serviciosPreventivos.set([servicioVacuna, { id: 8, tipoControlPreventivo: 'VACUNACION' } as any]);

      c.guardar();

      noRegistro(c, 'Falta servicio', 'Seleccione el servicio a cobrar');
    });

    it('envía la vacunación con su control y el próximo intervalo, y recarga la cartilla', () => {
      const c = crear();
      preparar(c);
      c.controlActivo.set(control());
      c.intervaloCantidad = 6;
      c.intervaloUnidad = 'MESES';
      c.lote = 'NV2026A001';
      cartilla.registrarVacunacion.and.returnValue(of({ data: { registroId: 90 } } as any));

      c.guardar();

      const enviado = cartilla.registrarVacunacion.calls.mostRecent().args[0];
      expect(enviado).toEqual(jasmine.objectContaining({
        mascotaId: 20, controlPreventivoId: 70, servicioId: 5, tipoVacunaId: 50, fechaAplicacion: '2026-10-19',
        programarProximoControl: true, intervaloCantidad: 6, intervaloUnidad: 'MESES'
      }));
      expect(c.resultado()?.registroId).toBe(90);
      expect(c.controlActivo()).toBeNull();
      expect(c.guardando()).toBeFalse();
      expect(cartilla.obtenerDetalle).toHaveBeenCalledWith(20);
      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success', summary: 'Aplicación registrada' }));
    });

    it('con una fecha exacta del próximo control no envía el intervalo, y sin programar no envía ninguno', () => {
      const c = crear();
      preparar(c);
      cartilla.registrarVacunacion.and.returnValue(of({ data: {} } as any));
      c.fechaProxima = '2027-04-01';
      c.guardar();
      let enviado = cartilla.registrarVacunacion.calls.mostRecent().args[0];
      expect(enviado.fechaProxima).toBe('2027-04-01');
      expect(enviado.intervaloCantidad).toBeUndefined();

      preparar(c);
      c.programarProximoControl = false;
      c.guardar();
      enviado = cartilla.registrarVacunacion.calls.mostRecent().args[0];
      expect(enviado.programarProximoControl).toBeFalse();
      expect(enviado.fechaProxima).toBeUndefined();
      expect(enviado.intervaloCantidad).toBeUndefined();
    });

    it('una desparasitación se envía por su propio servicio con el desparasitante elegido', () => {
      const c = crear();
      c.mascotaSel.set(luna);
      c.cambiarModo('DESPARASITACION');
      c.serviciosPreventivos.set([{ id: 6, tipoControlPreventivo: 'DESPARASITACION' } as any]);
      c.tipoDesparasitanteId = 3;
      c.fechaAplicacion = '2026-10-19';
      cartilla.registrarDesparasitacion.and.returnValue(of({ data: { registroId: 4 } } as any));

      c.guardar();

      expect(cartilla.registrarVacunacion).not.toHaveBeenCalled();
      expect(cartilla.registrarDesparasitacion.calls.mostRecent().args[0])
        .toEqual(jasmine.objectContaining({ tipoDesparasitanteId: 3, servicioId: 6 }));
    });

    it('si el servidor rechaza el registro muestra su motivo y no limpia lo escrito', () => {
      const c = crear();
      preparar(c);
      c.lote = 'NV2026A001';
      cartilla.registrarVacunacion.and.returnValue(throwError(() => ({ error: { message: 'Ya existe un registro de Nobivac' } })));

      c.guardar();

      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: 'Ya existe un registro de Nobivac' }));
      expect(c.lote).toBe('NV2026A001');
      expect(c.resultado()).toBeNull();
      expect(c.guardando()).toBeFalse();
    });
  });

  describe('recordatorio por WhatsApp', () => {
    const fila = (extra: object = {}) => ({
      id: 20, nombreCompleto: 'Luna', apoderadoNombreCompleto: 'Ana Pérez', apoderadoTelefono: '987 654-321',
      controlPendienteNombre: 'Rabia', controlPendienteTipo: 'VACUNACION', controlPendienteFecha: '2026-11-15T00:00:00',
      controlPendienteResumen: 'Vence en 5 días', ...extra
    }) as any;

    it('sin teléfono avisa y no abre nada', () => {
      const c = crear();
      const abrir = spyOn(window, 'open');

      c.abrirWhatsAppMascota(fila({ apoderadoTelefono: null }));

      expect(abrir).not.toHaveBeenCalled();
      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn', summary: 'Sin teléfono' }));
    });

    it('arma el mensaje con el nombre del propietario, la clínica, la mascota y la fecha en formato local', () => {
      const c = crear();
      const abrir = spyOn(window, 'open');

      c.abrirWhatsAppMascota(fila());

      const [url, destino] = abrir.calls.mostRecent().args as [string, string];
      expect(url).toContain('https://wa.me/51987654321?text=');
      expect(destino).toBe('_blank');
      const texto = decodeURIComponent(url.split('?text=')[1]);
      expect(texto).toContain('Hola, Ana');
      expect(texto).toContain('Clínica Patitas');
      expect(texto).toContain('Luna');
      expect(texto).toContain('Vacunación — Rabia');
      expect(texto).toContain('15/11/2026');
      expect(texto).toContain('Vence en 5 días');
    });
  });

  describe('activar y desactivar aplicaciones', () => {
    it('desactiva una aplicación activa por el servicio de su tipo y vuelve a cargar la matriz', () => {
      const c = crear();
      c.mascotaSel.set(luna);
      cartilla.cambiarEstadoVacunacion.and.returnValue(of({} as any));

      c.confirmarToggleEstado({ id: 9, tipo: 'VACUNACION', activo: true, nombreControl: 'Rabia' } as any);

      expect(cartilla.cambiarEstadoVacunacion).toHaveBeenCalledWith(9, false);
      expect(cartilla.obtenerMatriz).toHaveBeenCalledWith(20);
      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Desactivada' }));
    });

    it('reactiva una desparasitación inactiva por su propio servicio', () => {
      const c = crear();
      c.mascotaSel.set(luna);
      cartilla.cambiarEstadoDesparasitacion.and.returnValue(of({} as any));

      c.confirmarToggleEstado({ id: 4, tipo: 'DESPARASITACION', activo: false, nombreControl: 'Drontal' } as any);

      expect(cartilla.cambiarEstadoDesparasitacion).toHaveBeenCalledWith(4, true);
      expect(cartilla.cambiarEstadoVacunacion).not.toHaveBeenCalled();
      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Activada' }));
    });

    it('si el cambio falla lo informa y no recarga', () => {
      const c = crear();
      c.mascotaSel.set(luna);
      cartilla.cambiarEstadoVacunacion.and.returnValue(throwError(() => ({})));

      c.confirmarToggleEstado({ id: 9, tipo: 'VACUNACION', activo: true, nombreControl: 'Rabia' } as any);

      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: 'No se pudo cambiar el estado' }));
      expect(cartilla.obtenerMatriz).not.toHaveBeenCalled();
    });
  });

  describe('lista de mascotas y búsqueda', () => {
    it('sin clínica seleccionada no carga nada', () => {
      const c = crear({ selectedEnterprise: () => null, companyId: () => null, isSuperAdmin: () => true });

      c.ngOnInit();

      expect(cartilla.listarMascotasConCartilla).not.toHaveBeenCalled();
      expect(c.requiresCompanySelection).toBeTrue();
    });

    it('al filtrar por especie vuelve a la primera página y pide solo esa especie', () => {
      const c = crear();
      c.paginaActual = 3;

      c.filtrarPorEspecie('GATO');

      expect(c.paginaActual).toBe(0);
      expect(cartilla.listarMascotasConCartilla).toHaveBeenCalledWith(7, 'GATO', 0, c.tamanoPagina);
    });

    it('guarda el total de páginas y de registros que informa el servidor', () => {
      const c = crear();
      cartilla.listarMascotasConCartilla.and.returnValue(of({
        data: { content: [{ id: 1 }], page: { totalPages: 4, totalElements: 37 } }
      } as any));

      c.cargarMascotas();

      expect(c.mascotasLista().length).toBe(1);
      expect(c.totalPaginas).toBe(4);
      expect(c.totalRegistros).toBe(37);
    });

    it('si la lista no carga queda vacía en lugar de mostrar datos viejos', () => {
      const c = crear();
      c.mascotasLista.set([{ id: 1 } as any]);
      cartilla.listarMascotasConCartilla.and.returnValue(throwError(() => ({})));

      c.cargarMascotas();

      expect(c.mascotasLista()).toEqual([]);
      expect(c.totalRegistros).toBe(0);
      expect(c.cargando()).toBeFalse();
    });

    it('no busca con menos de dos letras y mantiene a la mascota elegida al principio de las sugerencias', () => {
      const c = crear();
      mascotas.listar.and.returnValue(of({ data: { content: [{ id: 21, nombreCompleto: 'Lupe' }, { id: 20, nombreCompleto: 'Luna' }] } } as any));

      c.onFilterMascota('L');
      expect(mascotas.listar).not.toHaveBeenCalled();
      expect(c.showDropdown()).toBeFalse();

      c.mascotaSel.set(luna);
      c.onFilterMascota('Lu');
      expect(c.mascotaSugerencias().map(m => m.id)).toEqual([20, 21]);
    });
  });

  describe('resumen de controles', () => {
    it('cuenta los atrasados, ordena por fecha y deja fuera los aplicados', () => {
      const c = crear();
      c.controles.set([
        control({ id: 1, estado: 'ATRASADO', fechaRecomendada: '2026-01-10' }),
        control({ id: 2, estado: 'PROGRAMADO', fechaRecomendada: '2027-02-01' }),
        control({ id: 3, estado: 'APLICADO', fechaRecomendada: '2026-03-01' }),
        control({ id: 4, tipo: 'DESPARASITACION', estado: 'ATRASADO', fechaRecomendada: '2026-01-05' })
      ]);

      expect(c.controlesOrdenados().map(x => x.id)).toEqual([1, 2]);
      expect(c.controlesAtrasados()).toBe(1);
      expect(c.proximaAplicacion()).toBe('2026-01-10');
    });

    it('rotula la próxima aplicación según esté atrasada, sea hoy o futura', () => {
      const c = crear();
      expect(c.etiquetaProximaAplicacion()).toBe('Sin controles pendientes');

      c.controles.set([control({ fechaRecomendada: '2000-01-01' })]);
      expect(c.etiquetaProximaAplicacion()).toBe('Control más atrasado');

      c.controles.set([control({ fechaRecomendada: c.fechaHoyLima })]);
      expect(c.etiquetaProximaAplicacion()).toBe('Aplicación para hoy');

      c.controles.set([control({ fechaRecomendada: '2999-01-01' })]);
      expect(c.etiquetaProximaAplicacion()).toBe('Próxima aplicación');
    });
  });

  describe('cuando una carga falla no deja la pantalla cargando para siempre', () => {
    it('al fallar el detalle de la cartilla avisa y libera el indicador', () => {
      const c = crear();
      cartilla.obtenerDetalle.and.returnValue(throwError(() => ({})));

      c.onAutocompleteSelect(luna);

      expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: 'No se pudo cargar la cartilla' }));
      expect(c.cargandoCtrl()).toBeFalse();
    });

    it('al fallar las búsquedas libera el indicador y deja los resultados vacíos', () => {
      const c = crear();
      mascotas.listar.and.returnValue(throwError(() => ({})));

      c.searchQuery = 'Luna';
      c.buscar();
      expect(c.buscando()).toBeFalse();
      expect(c.resultados()).toEqual([]);

      c.onFilterMascota('Lu');
      expect(c.buscando()).toBeFalse();
      expect(c.mascotaSugerencias()).toEqual([]);
    });
  });
});
