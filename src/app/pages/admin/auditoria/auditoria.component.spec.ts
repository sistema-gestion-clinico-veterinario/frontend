import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuditoriaComponent } from './auditoria.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AuditoriaComponent', () => {
  let component: AuditoriaComponent;
  let fixture: ComponentFixture<AuditoriaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditoriaComponent, HttpClientTestingModule],
    })
    .overrideComponent(AuditoriaComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(AuditoriaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('AuditoriaComponent - dispositivo', () => {
  let fixture: ComponentFixture<AuditoriaComponent>;
  let component: AuditoriaComponent;

  const registro = (parcial: Record<string, unknown> = {}) => ({
    id: 1, timestamp: '2026-10-06T10:15:00', userEmail: 'felipe@patitas.test', userRole: 'ROLE_ADMIN', companyId: 1,
    companyName: 'Clínica Patitas', action: 'PUBLICAR_AVISO_PRIVACIDAD', module: 'Seguridad',
    details: 'Se publicó la versión 2 del aviso de privacidad', ipAddress: '190.40.10.5', dispositivo: 'Chrome en Windows', ...parcial
  }) as any;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AuditoriaComponent, HttpClientTestingModule] }).compileComponents();
    fixture = TestBed.createComponent(AuditoriaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('la tabla tiene una columna de dispositivo junto al origen de la conexión', () => {
    component.logs.set([registro(), registro({ id: 2, dispositivo: null, ipAddress: null })]);
    fixture.detectChanges();

    const cabeceras = [...(fixture.nativeElement as HTMLElement).querySelectorAll('th')].map(th => th.textContent?.trim());
    expect(cabeceras).toContain('Origen IP');
    expect(cabeceras).toContain('Dispositivo');
    expect(cabeceras.indexOf('Dispositivo')).toBe(cabeceras.indexOf('Origen IP') + 1);
    expect(texto()).toContain('Chrome en Windows');
    expect(texto()).toContain('No registrado');
  });

  it('en el listado para celulares también se ve el dispositivo', () => {
    component.logs.set([registro()]);
    fixture.detectChanges();

    expect(texto()).toContain('190.40.10.5 · Chrome en Windows');
  });

  it('un evento antiguo sin dispositivo lo dice en vez de dejarlo en blanco', () => {
    component.logs.set([registro({ dispositivo: undefined })]);
    fixture.detectChanges();

    expect(texto()).toContain('Dispositivo no registrado');
  });

  it('se pueden filtrar los cambios al catálogo de vistas por módulo y por acción', () => {
    expect(component.modulesList).toContain('Catálogo de vistas');
    expect(component.actionsList).toEqual(jasmine.arrayContaining([
      'REGISTRAR_VISTA', 'MODIFICAR_VISTA', 'RETIRAR_VISTA', 'REORDENAR_VISTAS',
      'REGISTRAR_MODULO', 'MODIFICAR_MODULO', 'RETIRAR_MODULO'
    ]));
  });

  it('se pueden filtrar las solicitudes de cancelación de datos y su resolución', () => {
    expect(component.modulesList).toContain('Privacidad');
    expect(component.actionsList).toEqual(jasmine.arrayContaining([
      'SOLICITAR_CANCELACION_DATOS', 'REGISTRAR_SOLICITUD_CANCELACION_DATOS',
      'EJECUTAR_CANCELACION_DATOS', 'RECHAZAR_CANCELACION_DATOS'
    ]));
  });

  it('se pueden filtrar los cambios de roles, permisos y asignaciones, que son las acciones elevadas', () => {
    expect(component.modulesList).toEqual(jasmine.arrayContaining(['Roles', 'Empresa']));
    expect(component.actionsList).toEqual(jasmine.arrayContaining([
      'CREAR_ROL', 'MODIFICAR_ROL', 'ACTIVAR_ROL', 'DESACTIVAR_ROL', 'ELIMINAR_ROL',
      'MODIFICAR_PERMISOS_ROL', 'MODIFICAR_ASIGNACIONES_ROL', 'ACTUALIZAR_EMPRESA'
    ]));
  });
});
