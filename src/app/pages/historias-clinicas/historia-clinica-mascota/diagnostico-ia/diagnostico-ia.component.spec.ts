import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Subject, of, throwError } from 'rxjs';
import { DiagnosticoIaComponent } from './diagnostico-ia.component';
import { DiagnosticoIaService } from '../../../../core/services/diagnostico-ia.service';
import { AutorizacionIa, IaAutorizacionService } from '../../../../core/services/ia-autorizacion.service';
import { SseEvento } from '../../../../models/response/diagnostico-ia-response';

describe('DiagnosticoIaComponent', () => {
  let component: DiagnosticoIaComponent;
  let fixture: ComponentFixture<DiagnosticoIaComponent>;
  let autorizaciones: jasmine.SpyObj<IaAutorizacionService>;
  let diagnostico: jasmine.SpyObj<DiagnosticoIaService>;

  const autorizacion = (parcial: Partial<AutorizacionIa> = {}): AutorizacionIa => ({
    autorizada: true, apoderadoId: 5, titular: 'Ana Pérez', fecha: '2026-10-06T10:00:00', canal: 'PORTAL', ...parcial
  });
  const respuesta = (data: AutorizacionIa) => of({ success: true, message: 'ok', data });

  const historia = () => ({
    id: 1, numeroHc: 'HC-1', activa: true, mascotaId: 7, mascotaNombre: 'Luna', especie: 'Perro', sexo: 'Hembra',
    edadAproximadaMeses: 30,
    consultas: [{
      id: 3, fechaConsulta: '2026-10-01', motivoConsulta: 'Tos', diagnosticos: [], prescripciones: [], archivos: []
    }]
  }) as any;

  beforeEach(async () => {
    autorizaciones = jasmine.createSpyObj<IaAutorizacionService>('IaAutorizacionService', ['autorizacion']);
    diagnostico = jasmine.createSpyObj<DiagnosticoIaService>('DiagnosticoIaService', ['analizarStream']);
    await TestBed.configureTestingModule({
      imports: [DiagnosticoIaComponent, HttpClientTestingModule],
      providers: [
        { provide: IaAutorizacionService, useValue: autorizaciones },
        { provide: DiagnosticoIaService, useValue: diagnostico },
      ],
    })
    .overrideComponent(DiagnosticoIaComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(DiagnosticoIaComponent);
    component = fixture.componentInstance;
    component.hc = historia();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('al abrir el asistente consulta si el titular de esa mascota autorizó la IA', () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion()));

    component.abrir();

    expect(autorizaciones.autorizacion).toHaveBeenCalledWith(7);
    expect(component.autorizacion()?.autorizada).toBeTrue();
    expect(component.verificandoAutorizacion()).toBeFalse();
  });

  it('si el titular no autorizó, no se envía nada a la IA aunque se fuerce el análisis', async () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion({ autorizada: false, fecha: null, canal: null })));
    component.abrir();

    await component.analizar();

    expect(diagnostico.analizarStream).not.toHaveBeenCalled();
  });

  it('antes de saber si hay autorización tampoco se analiza', async () => {
    await component.analizar();

    expect(diagnostico.analizarStream).not.toHaveBeenCalled();
  });

  it('si no se pudo verificar, lo indica y permite reintentar', () => {
    autorizaciones.autorizacion.and.returnValues(throwError(() => ({ status: 500 })), respuesta(autorizacion()));

    component.abrir();
    expect(component.errorAutorizacion()).toBeTrue();
    expect(component.autorizacion()).toBeNull();

    component.verificarAutorizacion();
    expect(component.errorAutorizacion()).toBeFalse();
    expect(component.autorizacion()?.autorizada).toBeTrue();
  });

  it('con autorización envía la consulta con la mascota para que el servidor la compruebe', async () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion()));
    diagnostico.analizarStream.and.returnValue(new Subject<SseEvento>());
    component.abrir();

    await component.analizar();

    const formulario = diagnostico.analizarStream.calls.mostRecent().args[0];
    expect(formulario.get('mascotaId')).toBe('7');
    expect(formulario.get('especie')).toBe('Perro');
    expect(formulario.get('nombre_paciente')).toBe('Luna');
  });

  it('si el servidor responde que el titular retiró la autorización, la pantalla pasa a bloqueada', async () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion()));
    diagnostico.analizarStream.and.returnValue(throwError(() => ({
      status: 403, error: JSON.stringify({ success: false, message: 'x', data: { code: 'IA_SIN_AUTORIZACION' } })
    })));
    component.abrir();

    await component.analizar();

    expect(component.autorizacion()?.autorizada).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.streaming()).toBeFalse();
  });

  it('un error de conexión se muestra como tal y no bloquea la autorización', async () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion()));
    diagnostico.analizarStream.and.returnValue(throwError(() => ({ status: 502 })));
    component.abrir();

    await component.analizar();

    expect(component.error()).toContain('No se pudo conectar');
    expect(component.autorizacion()?.autorizada).toBeTrue();
  });

  it('el evento de error del servicio de IA y una respuesta vacía se muestran como error', async () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion()));
    const flujo = new Subject<SseEvento>();
    diagnostico.analizarStream.and.returnValue(flujo);
    component.abrir();
    await component.analizar();

    flujo.next({ type: 'error' });
    flujo.complete();

    expect(component.error()).toContain('no pudo responder');
  });

  it('una respuesta que termina sin texto ni error avisa que no hubo respuesta', async () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion()));
    const flujo = new Subject<SseEvento>();
    diagnostico.analizarStream.and.returnValue(flujo);
    component.abrir();
    await component.analizar();

    flujo.complete();

    expect(component.error()).toContain('no devolvió respuesta');
  });

  it('al cambiar de historia la autorización anterior no se arrastra', () => {
    autorizaciones.autorizacion.and.returnValue(respuesta(autorizacion()));
    component.abrir();

    component.ngOnChanges();

    expect(component.autorizacion()).toBeNull();
  });
});

describe('DiagnosticoIaComponent - pantalla', () => {
  let fixture: ComponentFixture<DiagnosticoIaComponent>;
  let component: DiagnosticoIaComponent;

  const autorizacion = (autorizada: boolean): AutorizacionIa => ({
    autorizada, apoderadoId: 5, titular: 'Ana Pérez', fecha: autorizada ? '2026-10-06T10:00:00' : null, canal: autorizada ? 'PORTAL' : null
  });
  const texto = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const botonAnalizar = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
    .find(b => /Analizar con IA/.test(b.textContent ?? ''));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagnosticoIaComponent, HttpClientTestingModule],
      providers: [
        { provide: IaAutorizacionService, useValue: jasmine.createSpyObj('IaAutorizacionService', ['autorizacion']) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DiagnosticoIaComponent);
    component = fixture.componentInstance;
    component.hc = {
      id: 1, numeroHc: 'HC-1', activa: true, mascotaId: 7, mascotaNombre: 'Luna', especie: 'Perro',
      consultas: [{ id: 3, fechaConsulta: '2026-10-01', motivoConsulta: 'Tos', diagnosticos: [], prescripciones: [], archivos: [] }]
    } as any;
    component.abierto.set(true);
    fixture.detectChanges();
  });

  it('mientras verifica la autorización no ofrece analizar', () => {
    component.verificandoAutorizacion.set(true);
    fixture.detectChanges();

    expect(texto()).toContain('Verificando la autorización del titular');
    expect(botonAnalizar()).toBeUndefined();
  });

  it('si el titular no autorizó, explica por qué y no ofrece analizar', () => {
    component.autorizacion.set(autorizacion(false));
    fixture.detectChanges();

    expect(texto()).toContain('La IA no se puede usar con los datos de Luna');
    expect(texto()).toContain('Ana Pérez, titular de la mascota, no ha autorizado');
    expect(botonAnalizar()).toBeUndefined();
  });

  it('con la autorización del titular ofrece analizar', () => {
    component.autorizacion.set(autorizacion(true));
    fixture.detectChanges();

    expect(texto()).not.toContain('La IA no se puede usar');
    expect(botonAnalizar()).toBeDefined();
  });

  it('si no se pudo verificar, avisa y permite reintentar', () => {
    component.errorAutorizacion.set(true);
    fixture.detectChanges();

    expect(texto()).toContain('No se pudo verificar la autorización del titular');
    expect(botonAnalizar()).toBeUndefined();
  });
});
