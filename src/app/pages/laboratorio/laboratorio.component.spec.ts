import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { LaboratorioComponent } from './laboratorio.component';
import { MascotaService } from '../../core/services/mascota.service';
import { LaboratorioIaService } from '../../core/services/laboratorio-ia.service';
import { AutorizacionIa, IaAutorizacionService } from '../../core/services/ia-autorizacion.service';

describe('LaboratorioComponent', () => {
  let component: LaboratorioComponent;
  let fixture: ComponentFixture<LaboratorioComponent>;
  let mascotas: jasmine.SpyObj<MascotaService>;
  let autorizaciones: jasmine.SpyObj<IaAutorizacionService>;
  let laboratorio: jasmine.SpyObj<LaboratorioIaService>;

  const luna = { id: 7, nombreCompleto: 'Luna', especie: 'GATO', apoderadoNombreCompleto: 'Ana Pérez' } as any;
  const autorizacion = (parcial: Partial<AutorizacionIa> = {}): AutorizacionIa => ({
    autorizada: true, apoderadoId: 5, titular: 'Ana Pérez', fecha: '2026-10-06T10:00:00', canal: 'PORTAL', ...parcial
  });
  const archivo = () => new File(['x'], 'hemograma.pdf', { type: 'application/pdf' });

  beforeEach(async () => {
    mascotas = jasmine.createSpyObj<MascotaService>('MascotaService', ['listar']);
    autorizaciones = jasmine.createSpyObj<IaAutorizacionService>('IaAutorizacionService', ['autorizacion']);
    laboratorio = jasmine.createSpyObj<LaboratorioIaService>('LaboratorioIaService', ['analizar']);
    await TestBed.configureTestingModule({
      imports: [LaboratorioComponent, HttpClientTestingModule],
      providers: [
        { provide: MascotaService, useValue: mascotas },
        { provide: IaAutorizacionService, useValue: autorizaciones },
        { provide: LaboratorioIaService, useValue: laboratorio },
      ],
    })
    .overrideComponent(LaboratorioComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(LaboratorioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('busca mascotas por nombre sin saturar al servidor y sin buscar con una sola letra', fakeAsync(() => {
    mascotas.listar.and.returnValue(of({ success: true, message: 'ok', data: { content: [luna] } } as any));

    component.buscar('L');
    tick(400);
    expect(mascotas.listar).not.toHaveBeenCalled();

    component.buscar('Lu');
    component.buscar('Lun');
    tick(400);

    expect(mascotas.listar).toHaveBeenCalledTimes(1);
    expect(mascotas.listar.calls.mostRecent().args[1]).toBe('Lun');
    expect(component.resultados()).toEqual([luna]);
  }));

  it('al elegir la mascota toma su especie y verifica la autorización de su titular', () => {
    autorizaciones.autorizacion.and.returnValue(of({ success: true, message: 'ok', data: autorizacion() }));

    component.elegirMascota(luna);

    expect(component.mascota()).toBe(luna);
    expect(component.especie()).toBe('Gato');
    expect(autorizaciones.autorizacion).toHaveBeenCalledWith(7);
    expect(component.autorizacion()?.autorizada).toBeTrue();
  });

  it('sin mascota o sin autorización del titular no se puede analizar', () => {
    component.archivo.set(archivo());
    expect(component.puedeAnalizar()).toBeFalse();

    autorizaciones.autorizacion.and.returnValue(of({ success: true, message: 'ok', data: autorizacion({ autorizada: false }) }));
    component.elegirMascota(luna);
    expect(component.puedeAnalizar()).toBeFalse();

    component.analizar();
    expect(laboratorio.analizar).not.toHaveBeenCalled();
  });

  it('con mascota autorizada y archivo se analiza y se envía la mascota', () => {
    autorizaciones.autorizacion.and.returnValue(of({ success: true, message: 'ok', data: autorizacion() }));
    laboratorio.analizar.and.returnValue(of({ secciones_presentes: ['hemograma'] } as any));
    component.elegirMascota(luna);
    const f = archivo();
    component.archivo.set(f);

    expect(component.puedeAnalizar()).toBeTrue();
    component.analizar();

    expect(laboratorio.analizar).toHaveBeenCalledWith(f, 'Gato', 7);
    expect(component.resultado()).not.toBeNull();
  });

  it('si el servidor responde que la autorización se retiró, queda bloqueado', () => {
    autorizaciones.autorizacion.and.returnValue(of({ success: true, message: 'ok', data: autorizacion() }));
    laboratorio.analizar.and.returnValue(throwError(() => ({
      status: 403, error: { success: false, message: 'El titular no autorizó', data: { code: 'IA_SIN_AUTORIZACION' } }
    })));
    component.elegirMascota(luna);
    component.archivo.set(archivo());

    component.analizar();

    expect(component.autorizacion()?.autorizada).toBeFalse();
    expect(component.puedeAnalizar()).toBeFalse();
    expect(component.cargando()).toBeFalse();
  });

  it('si no se pudo verificar la autorización lo indica y no deja analizar', () => {
    autorizaciones.autorizacion.and.returnValue(throwError(() => ({ status: 500 })));

    component.elegirMascota(luna);
    component.archivo.set(archivo());

    expect(component.errorAutorizacion()).toBeTrue();
    expect(component.puedeAnalizar()).toBeFalse();
  });

  it('cambiar de mascota descarta la autorización de la anterior', () => {
    autorizaciones.autorizacion.and.returnValue(of({ success: true, message: 'ok', data: autorizacion() }));
    component.elegirMascota(luna);

    component.quitarMascota();

    expect(component.mascota()).toBeNull();
    expect(component.autorizacion()).toBeNull();
  });
});

describe('LaboratorioComponent - pantalla', () => {
  let fixture: ComponentFixture<LaboratorioComponent>;
  let component: LaboratorioComponent;

  const luna = { id: 7, nombreCompleto: 'Luna', especie: 'PERRO', apoderadoNombreCompleto: 'Ana Pérez' } as any;
  const autorizacion = (autorizada: boolean): AutorizacionIa => ({
    autorizada, apoderadoId: 5, titular: 'Ana Pérez', fecha: autorizada ? '2026-10-06T10:00:00' : null, canal: autorizada ? 'PORTAL' : null
  });
  const texto = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const botonAnalizar = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
    .find(b => /Analizar laboratorio/.test(b.textContent ?? '')) as HTMLButtonElement | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LaboratorioComponent, HttpClientTestingModule],
      providers: [
        { provide: MascotaService, useValue: jasmine.createSpyObj('MascotaService', ['listar']) },
        { provide: IaAutorizacionService, useValue: jasmine.createSpyObj('IaAutorizacionService', ['autorizacion']) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LaboratorioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('pide elegir primero a la mascota y no deja analizar todavía', () => {
    component.archivo.set(new File(['x'], 'h.pdf'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[aria-label="Buscar mascota por nombre"]')).not.toBeNull();
    expect(texto()).toContain('requiere la autorización de su titular');
    expect(botonAnalizar()?.disabled).toBeTrue();
  });

  it('si el titular no autorizó, lo explica con su nombre y bloquea el análisis', () => {
    component.archivo.set(new File(['x'], 'h.pdf'));
    component.mascota.set(luna);
    component.autorizacion.set(autorizacion(false));
    fixture.detectChanges();

    expect(texto()).toContain('La IA no se puede usar con los datos de esta mascota');
    expect(texto()).toContain('Ana Pérez no ha autorizado');
    expect(botonAnalizar()?.disabled).toBeTrue();
  });

  it('con la autorización del titular muestra quién la dio y habilita el análisis', () => {
    component.archivo.set(new File(['x'], 'h.pdf'));
    component.mascota.set(luna);
    component.autorizacion.set(autorizacion(true));
    fixture.detectChanges();

    expect(texto()).toContain('Autorizada por Ana Pérez');
    expect(botonAnalizar()?.disabled).toBeFalse();
  });

  it('si no se pudo verificar permite reintentar', () => {
    component.mascota.set(luna);
    component.errorAutorizacion.set(true);
    fixture.detectChanges();

    expect(texto()).toContain('No se pudo verificar la autorización del titular');
    expect(texto()).toContain('Reintentar');
  });
});
