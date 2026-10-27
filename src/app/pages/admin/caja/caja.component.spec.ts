import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajaComponent } from './caja.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { PuntoCobro } from '../../../models/response/punto-cobro';

describe('CajaComponent', () => {
  let component: CajaComponent;
  let fixture: ComponentFixture<CajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajaComponent, HttpClientTestingModule],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('responsables de la caja', () => {
    it('muestra el nombre de la persona, no su correo', () => {
      expect(component.responsable('Ana Pérez', 'ana@example.test')).toBe('Ana Pérez');
    });

    it('si no se pudo resolver el nombre muestra el correo guardado', () => {
      expect(component.responsable(null, 'ana@example.test')).toBe('ana@example.test');
      expect(component.responsable('', 'ana@example.test')).toBe('ana@example.test');
    });

    it('sin nombre ni correo muestra una raya', () => {
      expect(component.responsable(undefined, undefined)).toBe('—');
    });
  });

  describe('puntos de cobro', () => {
    const punto = (parcial: Partial<PuntoCobro> = {}): PuntoCobro => ({
      id: 1, nombre: 'Mostrador 1', activa: true, vinculada: false, dispositivoNombre: null, dispositivoInfo: null, vinculadaAt: null,
      ultimoUsoAt: null, esEsteEquipo: false, sesionAbierta: false, abiertaPorNombre: null, ...parcial
    });
    let cajaService: any;
    let aviso: jasmine.Spy;
    const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    beforeEach(() => {
      (component as any).authStore.setAuth({ roles: ['ROLE_ADMIN'], companyId: 7, activeRolePurpose: 'COMPANY_ADMIN', menu: [] } as any);
      cajaService = (component as any).cajaService;
      aviso = spyOn((component as any).messageService, 'add');
    });

    it('un administrador puede gestionar los puntos de cobro; el personal no', () => {
      expect(component.puedeGestionarPuntos()).toBeTrue();
      (component as any).authStore.setAuth({ roles: ['ROLE_X'], companyId: 7, activeRolePurpose: 'CUSTOM', menu: [] } as any);
      expect(component.puedeGestionarPuntos()).toBeFalse();
    });

    it('oculta Puntos de cobro para el personal y bloquea su apertura programática', () => {
      const listar = spyOn(cajaService, 'puntosCobro');
      (component as any).authStore.setAuth({ roles: ['ROLE_VETERINARIO'], companyId: 7, activeRolePurpose: 'CUSTOM', menu: [] } as any);

      fixture.detectChanges();
      component.abrirPuntos();

      const botonPuntos = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(boton => boton.textContent?.includes('Puntos de cobro'));
      expect(botonPuntos).toBeUndefined();
      expect(component.showPuntos()).toBeFalse();
      expect(listar).not.toHaveBeenCalled();
    });

    it('muestra Puntos de cobro a un administrador de empresa', () => {
      fixture.detectChanges();

      const botonPuntos = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(boton => boton.textContent?.includes('Puntos de cobro'));
      expect(botonPuntos).toBeDefined();
    });

    it('muestra qué punto de cobro es este equipo', () => {
      component.estadoEquipo.set({ modo: 'DISPOSITIVO', cajaNombre: 'Mostrador 2', equipoNombre: 'PC Recepción 02', mensaje: 'Equipo registrado.' });
      fixture.detectChanges();

      expect(texto()).toContain('Este equipo');
      expect(texto()).toContain('PC Recepción 02');
      expect(texto()).toContain('Mostrador 2');
      expect(component.equipoSinRegistrar()).toBeFalse();
    });

    it('un administrador con equipo sin registrar recibe la acción correcta y no puede abrir caja', () => {
      component.estadoEquipo.set({ modo: 'NO_REGISTRADO', cajaNombre: null, equipoNombre: null, mensaje: 'Este equipo no está registrado como punto de cobro.' });
      component.estadoEquipoLoading.set(false);
      component.estadoEquipoError.set(false);
      component.sesionCaja.set(null);
      fixture.detectChanges();

      const abrir = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(boton => boton.textContent?.includes('Abrir caja'));
      const registrar = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(boton => boton.textContent?.includes('Registrar este equipo'));
      expect(abrir).toBeUndefined();
      expect(registrar).toBeDefined();
      expect(texto()).toContain('Sin registrar');

      component.abrirModalSesion('ABRIR');
      expect(component.showSesionModal()).toBeNull();
      expect(aviso).toHaveBeenCalled();
    });

    it('el personal con equipo sin registrar ve que debe solicitarlo a un administrador', () => {
      (component as any).authStore.setAuth({ roles: ['ROLE_VETERINARIO'], companyId: 7, activeRolePurpose: 'CUSTOM', menu: [] } as any);
      component.estadoEquipo.set({ modo: 'NO_REGISTRADO', cajaNombre: null, equipoNombre: null, mensaje: 'Este equipo no está registrado como punto de cobro.' });
      component.estadoEquipoLoading.set(false);
      component.estadoEquipoError.set(false);
      component.sesionCaja.set(null);
      fixture.detectChanges();

      expect(texto()).toContain('Solicita el registro a un administrador');
      expect(texto()).not.toContain('Registrar este equipo');
    });

    it('no permite abrir caja mientras verifica el equipo', () => {
      component.estadoEquipo.set(null);
      component.estadoEquipoLoading.set(true);
      component.estadoEquipoError.set(false);
      component.sesionCaja.set(null);
      fixture.detectChanges();

      expect(texto()).toContain('Verificando equipo...');
      expect(texto()).not.toContain('Abrir caja');
    });

    it('carga el estado de este equipo al pedirlo', () => {
      spyOn(cajaService, 'esteEquipo').and.returnValue(of({ success: true, message: 'ok', data: { modo: 'SENCILLO', cajaNombre: 'Caja principal', equipoNombre: null, mensaje: 'x' } }));

      component.cargarEstadoEquipo();

      expect(cajaService.esteEquipo).toHaveBeenCalledWith(7);
      expect(component.estadoEquipo()?.modo).toBe('SENCILLO');
    });

    it('lista los puntos de cobro con su equipo y quién tiene la caja abierta', () => {
      spyOn(cajaService, 'puntosCobro').and.returnValue(of({ success: true, message: 'ok', data: [
        punto({ vinculada: true, dispositivoNombre: 'PC Recepción 01', dispositivoInfo: 'Chrome en Windows', esEsteEquipo: true }),
        punto({ id: 2, nombre: 'Mostrador 2', sesionAbierta: true, abiertaPorNombre: 'Luis Gómez' })
      ] }));

      component.abrirPuntos();
      fixture.detectChanges();

      expect(texto()).toContain('Chrome en Windows');
      expect(texto()).toContain('PC Recepción 01');
      expect(texto()).toContain('Abierta por Luis Gómez');
      expect(texto()).toContain('Mostrador 2');
    });

    it('crea un punto con el nombre limpio y recarga la lista', () => {
      const crear = spyOn(cajaService, 'crearPuntoCobro').and.returnValue(of({ success: true, message: 'ok', data: punto({ id: 3 }) }));
      const listar = spyOn(component, 'cargarPuntos');
      component.nuevoPuntoNombre = '  Mostrador   3 ';

      component.crearPunto();

      expect(crear).toHaveBeenCalledWith(7, 'Mostrador 3');
      expect(listar).toHaveBeenCalled();
      expect(component.nuevoPuntoNombre).toBe('');
    });

    it('no crea un punto con un nombre demasiado corto', () => {
      const crear = spyOn(cajaService, 'crearPuntoCobro');
      component.nuevoPuntoNombre = 'a';

      component.crearPunto();

      expect(crear).not.toHaveBeenCalled();
      expect(aviso.calls.mostRecent().args[0].summary).toBe('Nombre inválido');
    });

    it('registra este equipo en el punto elegido y refresca el estado', () => {
      const vincular = spyOn(cajaService, 'vincularPuntoCobro').and.returnValue(of({ success: true, message: 'ok', data: punto() }));
      spyOn(component, 'cargarPuntos');
      const estado = spyOn(component, 'cargarEstadoEquipo');

      component.prepararVinculacion(punto());
      component.nombreEquipo = '  PC   Recepción 01 ';
      component.vincularPunto();

      expect(vincular).toHaveBeenCalledWith(1, 7, 'PC Recepción 01');
      expect(estado).toHaveBeenCalled();
    });

    it('si el servidor rechaza la operación muestra su motivo', () => {
      spyOn(cajaService, 'vincularPuntoCobro').and.returnValue(throwError(() => ({ error: { message: 'Cierra la caja de este punto de cobro antes de cambiar su equipo' } })));

      component.prepararVinculacion(punto());
      component.nombreEquipo = 'PC Recepción 01';
      component.vincularPunto();

      expect(aviso.calls.mostRecent().args[0].detail).toContain('Cierra la caja');
      expect(component.trabajandoPuntos()).toBeFalse();
    });

    it('un administrador cierra la caja de otra persona sin afectar la suya', () => {
      const propia = { id: 10, estado: 'ABIERTA' } as any;
      component.sesionCaja.set(propia);
      const cerrar = spyOn(cajaService, 'cerrarCaja').and.returnValue(of({ success: true, message: 'ok', data: { id: 11, estado: 'CERRADA' } }));
      spyOn(component, 'cargar');

      component.cerrarSesionAjena({ id: 11, efectivoEsperado: 150 } as any);
      component.guardarSesion();

      expect(cerrar).toHaveBeenCalledWith(7, 150, '', 11);
      expect(component.sesionCaja()).toBe(propia);
      expect(component.sesionAjenaId()).toBeNull();
    });

    it('al cerrar la propia caja no se manda ninguna sesión ajena', () => {
      component.sesionCaja.set({ id: 10, estado: 'ABIERTA', efectivoEsperado: 70 } as any);
      const cerrar = spyOn(cajaService, 'cerrarCaja').and.returnValue(of({ success: true, message: 'ok', data: { id: 10, estado: 'CERRADA' } }));
      spyOn(component, 'cargar');

      component.abrirModalSesion('CERRAR');
      component.guardarSesion();

      expect(cerrar).toHaveBeenCalledWith(7, 70, '', undefined);
      expect(component.sesionCaja()).toBeNull();
    });
  });
});
