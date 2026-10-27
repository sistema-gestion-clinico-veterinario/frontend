import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { PendientesPrivacidadService } from './pendientes-privacidad.service';
import { PrivacidadService } from './privacidad.service';
import { ConsentimientoEstado } from '../../models/privacy/privacidad.model';
import { AuthStore } from '../../store/auth.store';
import { BackupMonitorService } from './backup-monitor.service';
import { BackupExecution } from '../../models/backup/backup-execution.model';

describe('PendientesPrivacidadService', () => {
  let privacidad: jasmine.SpyObj<PrivacidadService>;
  let respaldos: jasmine.SpyObj<BackupMonitorService>;
  let eventos: Subject<unknown>;
  let companyId: ReturnType<typeof signal<number | null>>;
  let rolId: ReturnType<typeof signal<number | null>>;
  let proposito: ReturnType<typeof signal<string | null>>;
  let terminos: ReturnType<typeof signal<boolean>>;
  let vencidos: ReturnType<typeof signal<boolean>>;

  const estado = (parcial: Partial<ConsentimientoEstado> = {}, decisionIa?: 'SIN_REGISTRO' | 'OTORGADO' | 'RETIRADO'): ConsentimientoEstado => ({
    avisoPublicado: true, avisoVersion: 1, informada: true, informadaVersion: 1, informadaFecha: null, informadaCanal: null,
    vistaPorLaPersona: true,
    finalidades: decisionIa
      ? [{ codigo: 'USO_IA_CLINICA', descripcion: 'IA', estado: decisionIa, fecha: null, canal: null }] : [],
    ...parcial
  });
  const responde = (e: ConsentimientoEstado) => of({ success: true, message: 'ok', data: e });
  const ejecucionRespaldo = (parcial: Partial<BackupExecution> = {}): BackupExecution => ({
    id: 22, runId: 'run-22', runAttempt: 1, recoveryPointId: 'rp-22', retentionPolicy: 'p01',
    triggerType: 'SCHEDULED', status: 'FAILED', databaseStatus: 'SUCCESS', restrictionsStatus: 'SUCCESS',
    storageStatus: 'FAILED', restorationVerified: true, startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(), commitSha: 'abc', workflowUrl: 'https://github.test/run/22',
    ...parcial
  });
  const paginaRespaldos = (content: BackupExecution[] = []) => of({
    success: true, message: 'ok', data: {
      content, totalElements: content.length, totalPages: 1, size: 50, number: 0,
      numberOfElements: content.length, first: true, last: true, empty: content.length === 0
    }
  });

  function crear(): PendientesPrivacidadService {
    const servicio = TestBed.inject(PendientesPrivacidadService);
    TestBed.tick();
    return servicio;
  }

  beforeEach(() => {
    sessionStorage.clear();
    privacidad = jasmine.createSpyObj<PrivacidadService>('PrivacidadService', ['miEstado']);
    privacidad.miEstado.and.returnValue(responde(estado()));
    respaldos = jasmine.createSpyObj<BackupMonitorService>('BackupMonitorService', ['list']);
    respaldos.list.and.returnValue(paginaRespaldos());
    eventos = new Subject();
    companyId = signal<number | null>(1);
    rolId = signal<number | null>(3);
    proposito = signal<string | null>('CLIENT_PORTAL');
    terminos = signal(false);
    vencidos = signal(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: PrivacidadService, useValue: privacidad },
        { provide: BackupMonitorService, useValue: respaldos },
        { provide: Router, useValue: { events: eventos.asObservable() } },
        { provide: AuthStore, useValue: {
          companyId, activeRoleId: rolId, activeRolePurpose: proposito,
          needsLegalAcceptance: terminos, legalAcceptanceOverdue: vencidos
        } },
      ],
    });
  });

  it('con todo al día no hay nada pendiente', () => {
    const servicio = crear();

    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
    expect(servicio.pendientes()).toEqual([]);
  });

  it('un aviso que la persona aún no leyó aparece como pendiente, con su ruta', () => {
    privacidad.miEstado.and.returnValue(responde(estado({ vistaPorLaPersona: false, informada: false, informadaVersion: null })));

    const servicio = crear();

    expect(servicio.pendientes()).toEqual([jasmine.objectContaining({
      id: 'aviso', titulo: 'Aviso de privacidad', ruta: '/profile', fragmento: 'privacidad', opcional: false })]);
  });

  it('si la clínica publicó una versión nueva, lo dice como actualización', () => {
    privacidad.miEstado.and.returnValue(responde(estado({
      vistaPorLaPersona: false, avisoVersion: 3, informadaVersion: 2 })));

    const [pendiente] = crear().pendientes();

    expect(pendiente.titulo).toBe('Aviso de privacidad actualizado');
    expect(pendiente.detalle).toContain('La clínica actualizó su aviso de privacidad');
    expect(pendiente.detalle).not.toMatch(/versi[oó]n/i);
  });

  it('sin aviso publicado no hay nada que leer', () => {
    privacidad.miEstado.and.returnValue(responde(estado({ avisoPublicado: false, avisoVersion: null, vistaPorLaPersona: false })));

    expect(crear().pendientes()).toEqual([]);
  });

  it('los términos de la plataforma pendientes aparecen, y se indica si el plazo venció', () => {
    terminos.set(true);
    const servicio = crear();

    expect(servicio.pendientes()).toEqual([jasmine.objectContaining({ id: 'terminos', ruta: '/legal/accept', opcional: false })]);
    expect(servicio.pendientes()[0].detalle).toContain('actualizó');

    vencidos.set(true);
    expect(servicio.pendientes()[0].detalle).toContain('venció');

    terminos.set(false);
    expect(servicio.pendientes()).toEqual([]);
  });

  it('un cliente que no decidió sobre la IA ve el pendiente opcional hacia su perfil', () => {
    privacidad.miEstado.and.returnValue(responde(estado({}, 'SIN_REGISTRO')));

    expect(crear().pendientes()).toEqual([jasmine.objectContaining({
      id: 'ia', ruta: '/profile', fragmento: 'privacidad', opcional: true })]);
  });

  it('tras decidir sobre la IA, en cualquier sentido, ya no aparece', () => {
    for (const decision of ['OTORGADO', 'RETIRADO'] as const) {
      privacidad.miEstado.and.returnValue(responde(estado({}, decision)));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [
        { provide: PrivacidadService, useValue: privacidad },
        { provide: BackupMonitorService, useValue: respaldos },
        { provide: Router, useValue: { events: eventos.asObservable() } },
        { provide: AuthStore, useValue: { companyId, activeRoleId: rolId, activeRolePurpose: proposito, needsLegalAcceptance: terminos, legalAcceptanceOverdue: vencidos } },
      ] });

      expect(crear().pendientes()).toEqual([]);
    }
  });

  it('el personal de la clínica no recibe el pendiente de la IA, que es una decisión del cliente', () => {
    proposito.set('COMPANY_ADMIN');
    privacidad.miEstado.and.returnValue(responde(estado({}, 'SIN_REGISTRO')));

    expect(crear().pendientes()).toEqual([]);
  });

  it('solo el administrador de plataforma recibe alertas de respaldos con problemas', () => {
    companyId.set(null);
    proposito.set('PLATFORM_ADMIN');
    respaldos.list.and.returnValue(paginaRespaldos([
      ejecucionRespaldo({ id: 20 }),
      ejecucionRespaldo({ id: 22, status: 'PARTIAL', databaseStatus: 'FAILED', storageStatus: 'SKIPPED' })
    ]));

    const servicio = crear();

    expect(privacidad.miEstado).not.toHaveBeenCalled();
    expect(respaldos.list).toHaveBeenCalledOnceWith(0, 50, true);
    expect(servicio.pendientes()).toEqual([
      jasmine.objectContaining({
        id: 'respaldo-20', titulo: 'Respaldo fallido', ruta: '/admin/respaldos', opcional: false,
        detalle: jasmine.stringMatching(/Falló: Archivos clínicos$/)
      }),
      jasmine.objectContaining({
        id: 'respaldo-22', titulo: 'Respaldo parcial', ruta: '/admin/respaldos', opcional: false,
        detalle: jasmine.stringMatching(/Falló: Base de datos$/)
      })
    ]);
  });

  it('un rol de clínica nunca consulta el resumen operativo de respaldos', () => {
    proposito.set('COMPANY_ADMIN');

    crear();

    expect(respaldos.list).not.toHaveBeenCalled();
  });

  it('lo opcional se puede dejar para más tarde durante la sesión, y lo obligatorio no', () => {
    privacidad.miEstado.and.returnValue(responde(estado({ vistaPorLaPersona: false }, 'SIN_REGISTRO')));
    const servicio = crear();
    expect(servicio.pendientes().map(p => p.id)).toEqual(['aviso', 'ia']);

    servicio.descartar('aviso');
    expect(servicio.pendientes().map(p => p.id)).toEqual(['aviso', 'ia']);

    servicio.descartar('ia');
    expect(servicio.pendientes().map(p => p.id)).toEqual(['aviso']);
    expect(sessionStorage.getItem('pendientes_privacidad_descartados:1:3')).toBe('["ia"]');
  });

  it('lo que se dejó para más tarde no se arrastra a otra persona del mismo navegador', () => {
    privacidad.miEstado.and.returnValue(responde(estado({}, 'SIN_REGISTRO')));
    const servicio = crear();
    servicio.descartar('ia');
    expect(servicio.pendientes()).toEqual([]);

    rolId.set(9);
    TestBed.tick();

    expect(servicio.pendientes().map(p => p.id)).toEqual(['ia']);
  });

  it('al salir de la pantalla donde se resuelve, se vuelve a consultar para que el pendiente desaparezca', () => {
    privacidad.miEstado.and.returnValues(responde(estado({ vistaPorLaPersona: false })), responde(estado()));
    const servicio = crear();
    eventos.next(new NavigationEnd(1, '/profile#privacidad', '/profile'));
    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
    expect(servicio.pendientes().length).toBe(1);

    eventos.next(new NavigationEnd(2, '/apoderado/dashboard', '/apoderado/dashboard'));

    expect(privacidad.miEstado).toHaveBeenCalledTimes(2);
    expect(servicio.pendientes()).toEqual([]);
  });

  it('navegar entre pantallas comunes con algo pendiente no dispara consultas, aunque haya muchas redirecciones', () => {
    privacidad.miEstado.and.returnValue(responde(estado({ vistaPorLaPersona: false })));
    crear();

    for (let i = 1; i <= 20; i++) {
      eventos.next(new NavigationEnd(i, i % 2 ? '/mascotas' : '/citas', i % 2 ? '/mascotas' : '/citas'));
    }

    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
  });

  it('con todo al día no se consulta al navegar, ni al salir de esas pantallas', () => {
    const servicio = crear();

    eventos.next(new NavigationEnd(1, '/profile', '/profile'));
    eventos.next(new NavigationEnd(2, '/citas', '/citas'));

    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
    expect(servicio.pendientes()).toEqual([]);
  });

  it('al volver a la pestaña no vuelve a consultar ni activa actualizaciones visuales inesperadas', () => {
    crear();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(privacidad.miEstado).toHaveBeenCalledTimes(1);
  });

  it('si la consulta falla conserva lo último que sabía y no rompe nada', () => {
    privacidad.miEstado.and.returnValues(responde(estado({ vistaPorLaPersona: false })), throwError(() => ({ status: 500 })));
    const servicio = crear();

    servicio.refrescar();

    expect(servicio.pendientes().length).toBe(1);
  });

  it('sin clínica en la sesión no consulta ni muestra nada', () => {
    companyId.set(null);

    const servicio = crear();

    expect(privacidad.miEstado).not.toHaveBeenCalled();
    expect(servicio.pendientes()).toEqual([]);
  });

  it('al cambiar de clínica o de rol se descarta lo anterior y se consulta de nuevo', () => {
    privacidad.miEstado.and.returnValues(responde(estado({ vistaPorLaPersona: false })), responde(estado()));
    const servicio = crear();
    expect(servicio.pendientes().length).toBe(1);

    companyId.set(2);
    TestBed.tick();

    expect(privacidad.miEstado).toHaveBeenCalledTimes(2);
    expect(servicio.pendientes()).toEqual([]);
  });
});
