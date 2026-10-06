import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientComponent } from './client.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

describe('ClientComponent', () => {
  let component: ClientComponent;
  let fixture: ComponentFixture<ClientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientComponent, HttpClientTestingModule],
      providers: [MessageService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('suspender, dar de baja y reactivar', () => {
    let cambiarEstado: jasmine.Spy;
    let toast: jasmine.Spy;
    const resultado = (parcial: Partial<Record<string, string[]>> = {}) => ({
      success: true,
      data: { mascotasPausadas: [], mascotasRestauradas: [], mascotasQueSiguenActivas: [], mascotasConCitasVigentes: [], ...parcial }
    });
    const persona = (activo: boolean, tipoInactividad?: 'SUSPENSION' | 'BAJA') =>
      ({ id: 7, nombre: 'Luis', apellido: 'Rojas', activo, tipoInactividad }) as any;

    beforeEach(() => {
      cambiarEstado = spyOn((component as any).apoderadoService, 'cambiarEstado').and.returnValue(of(resultado()));
      toast = spyOn((component as any).messageService, 'add');
      spyOn(component, 'loadClients');
    });

    it('suspender pide un motivo opcional y envía el tipo SUSPENSION', () => {
      component.changeStatus(persona(true), 'SUSPENSION');

      expect(component.confirmDialog()?.askReason).toBeTrue();
      component.confirmReason.set('  Mora en pagos ');
      component.confirmAction();

      expect(cambiarEstado).toHaveBeenCalledWith(7, false, { tipo: 'SUSPENSION', reason: 'Mora en pagos' });
    });

    it('dar de baja envía el tipo BAJA', () => {
      component.changeStatus(persona(true), 'BAJA');
      component.confirmAction();

      expect(cambiarEstado).toHaveBeenCalledWith(7, false, { tipo: 'BAJA', reason: undefined });
    });

    it('reactivar no pide motivo', () => {
      component.changeStatus(persona(false, 'BAJA'), 'REACTIVAR');

      expect(component.confirmDialog()?.askReason).toBeFalse();
      component.confirmAction();

      expect(cambiarEstado).toHaveBeenCalledWith(7, true, { tipo: undefined, reason: undefined });
    });

    it('el diálogo avisa de lo que pasará con las mascotas', () => {
      component.changeStatus(persona(true), 'BAJA');
      expect(component.confirmDialog()?.message).toContain('mascotas');

      component.changeStatus(persona(false, 'BAJA'), 'REACTIVAR');
      expect(component.confirmDialog()?.message).toContain('se restaurarán');
    });

    it('al reactivar informa qué mascotas se restauraron', () => {
      cambiarEstado.and.returnValue(of(resultado({ mascotasRestauradas: ['Luna', 'Max'] })));
      component.changeStatus(persona(false, 'BAJA'), 'REACTIVAR');
      component.confirmAction();

      expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({
        severity: 'info', summary: 'Mascotas del cliente',
        detail: jasmine.stringContaining('Luna, Max')
      }));
    });

    it('avisa de las mascotas que siguen activas por otro autorizador y de las que no se pausaron por citas', () => {
      cambiarEstado.and.returnValue(of(resultado({ mascotasQueSiguenActivas: ['Luna'], mascotasConCitasVigentes: ['Rex'] })));
      component.changeStatus(persona(true), 'SUSPENSION');
      component.confirmAction();

      expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({
        severity: 'warn',
        detail: jasmine.stringMatching(/Luna.*transferirles la titularidad.*citas vigentes: Rex/)
      }));
    });

    it('si no hubo nada que contar de las mascotas, no muestra el aviso adicional', () => {
      component.changeStatus(persona(true), 'SUSPENSION');
      component.confirmAction();

      expect(toast).toHaveBeenCalledTimes(1);
    });

    it('un motivo escrito en un diálogo anterior no se arrastra al siguiente', () => {
      component.changeStatus(persona(true), 'SUSPENSION');
      component.confirmReason.set('Motivo viejo');
      component.cancelConfirm();

      component.changeStatus(persona(true), 'BAJA');

      expect(component.confirmReason()).toBe('');
    });

    it('al resolver las citas pendientes se reintenta la misma acción con el mismo motivo', () => {
      cambiarEstado.and.returnValues(
        throwError(() => ({ error: { message: 'No se puede desactivar un cliente con citas programadas vigentes' } })),
        of(resultado()));
      component.changeStatus(persona(true), 'BAJA');
      component.confirmReason.set('Se mudó');
      component.confirmAction();

      component.onConflictsResolved();

      expect(cambiarEstado.calls.mostRecent().args).toEqual([7, false, { tipo: 'BAJA', reason: 'Se mudó' }]);
    });

    describe('registrar a un cliente que ya existe dado de baja o suspendido', () => {
      let registrar: jasmine.Spy;
      const rechazo = (tipo: 'BAJA' | 'SUSPENSION') => throwError(() => ({
        status: 409,
        error: {
          success: false,
          message: 'Este cliente fue dado de baja. Para devolverle el acceso usa «Reactivar» en la lista de clientes',
          data: { code: 'CLIENTE_INACTIVO', apoderadoId: 41, tipoInactividad: tipo }
        }
      }));
      const datos = () => ({ nombre: 'Luis', apellido: 'Rojas' }) as any;

      beforeEach(() => {
        registrar = spyOn((component as any).apoderadoService, 'registrar').and.returnValue(rechazo('BAJA'));
      });

      it('ofrece reactivar al cliente existente en lugar de mostrar solo el error', () => {
        (component as any).submitClient(datos());

        const dialogo = component.confirmDialog();
        expect(dialogo?.title).toBe('Cliente ya registrado');
        expect(dialogo?.confirmLabel).toBe('Reactivar');
        expect(dialogo?.message).toContain('fue dado de baja');
        expect(dialogo?.message).toContain('se restaurarán las mascotas');
        expect(toast).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
      });

      it('si el cliente está suspendido lo dice así', () => {
        registrar.and.returnValue(rechazo('SUSPENSION'));
        (component as any).submitClient(datos());

        expect(component.confirmDialog()?.message).toContain('está suspendido');
      });

      it('confirmar reactiva al cliente existente y cierra el formulario', () => {
        component.displayModal.set(true);
        (component as any).submitClient(datos());
        component.confirmAction();

        expect(cambiarEstado).toHaveBeenCalledWith(41, true, {});
        expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ detail: 'Reactivado correctamente' }));
        expect(component.displayModal()).toBeFalse();
      });

      it('si no se confirma no se reactiva nada y el formulario sigue abierto', () => {
        component.displayModal.set(true);
        (component as any).submitClient(datos());
        component.cancelConfirm();

        expect(cambiarEstado).not.toHaveBeenCalled();
        expect(component.displayModal()).toBeTrue();
      });

      it('si reactivar falla muestra el motivo del servidor', () => {
        cambiarEstado.and.returnValue(throwError(() => ({ error: { message: 'Solo un administrador puede gestionar la cuenta de otro administrador' } })));
        component.displayModal.set(true);
        (component as any).submitClient(datos());
        component.confirmAction();

        expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({
          severity: 'error', detail: 'Solo un administrador puede gestionar la cuenta de otro administrador'
        }));
        expect(component.displayModal()).toBeTrue();
      });

      it('un error común al registrar sigue mostrándose como error', () => {
        registrar.and.returnValue(throwError(() => ({ status: 400, error: { message: 'El correo ya está registrado' } })));
        (component as any).submitClient(datos());

        expect(component.confirmDialog()).toBeNull();
        expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: 'El correo ya está registrado' }));
      });
    });

    describe('eliminar', () => {
      let eliminar: jasmine.Spy;

      beforeEach(() => {
        eliminar = spyOn((component as any).apoderadoService, 'eliminar').and.returnValue(of(resultado()));
      });

      it('explica que eliminar es una baja que conserva los registros', () => {
        component.deleteClient(persona(true));

        expect(component.confirmDialog()?.message).toContain('Se le dará de baja');
        expect(component.confirmDialog()?.message).toContain('sus registros se conservan');
      });

      it('confirmar elimina por la ruta de administradores y avisa que quedó dado de baja', () => {
        component.deleteClient(persona(true));
        component.confirmAction();

        expect(eliminar).toHaveBeenCalledWith(7);
        expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ detail: 'Dado de baja correctamente' }));
      });

      it('si tiene citas vigentes abre el diálogo para resolverlas y reintenta la baja con el mismo motivo', () => {
        eliminar.and.returnValue(throwError(() => ({ error: { message: 'No se puede desactivar un cliente con citas programadas vigentes' } })));
        component.deleteClient(persona(true));
        component.confirmAction();

        expect(component.conflictDialogVisible()).toBeTrue();

        cambiarEstado.and.returnValue(of(resultado()));
        component.onConflictsResolved();

        expect(cambiarEstado.calls.mostRecent().args).toEqual([7, false, { tipo: 'BAJA', reason: 'Eliminado por el administrador' }]);
      });
    });

    describe('menú de acciones', () => {
      const etiquetas = (cliente: any) => component.clientActionItems(cliente).map(item => item.label);

      beforeEach(() => spyOn((component as any).authStore, 'hasAccess').and.returnValue(true));

      it('"Eliminar" solo lo ve un administrador', () => {
        spyOn((component as any).authStore, 'isAdmin').and.returnValue(false);
        expect(etiquetas(persona(true))).not.toContain('Eliminar');

        (component as any).authStore.isAdmin.and.returnValue(true);
        const otro = persona(true);
        expect(etiquetas(otro)).toContain('Eliminar');
      });

      it('una persona activa se suspende o se da de baja', () => {
        expect(etiquetas(persona(true))).toEqual(jasmine.arrayContaining(['Suspender', 'Dar de baja']));
      });

      it('una suspendida pasa a baja o se reactiva', () => {
        const items = etiquetas(persona(false, 'SUSPENSION'));
        expect(items).toEqual(jasmine.arrayContaining(['Dar de baja', 'Reactivar']));
        expect(items).not.toContain('Suspender');
      });

      it('una dada de baja solo se reactiva', () => {
        const items = etiquetas(persona(false, 'BAJA'));
        expect(items).toContain('Reactivar');
        expect(items).not.toContain('Suspender');
        expect(items).not.toContain('Dar de baja');
      });
    });
  });

  describe('autorización del uso de IA', () => {
    const estado = (estadoIa?: 'OTORGADO' | 'RETIRADO') => ({
      avisoPublicado: true, avisoVersion: 1, informada: true, finalidades: estadoIa
        ? [{ codigo: 'USO_IA_CLINICA', descripcion: 'IA', estado: estadoIa, fecha: null, canal: null }] : []
    }) as any;

    beforeEach(() => {
      component.selectedClientId.set(7);
      spyOn(component, 'canClientAction').and.returnValue(true);
    });

    it('sin registro, el cliente figura como no autorizado', () => {
      component.estadoPrivacidadCliente.set(estado());

      expect(component.estadoIaCliente()).toBe('SIN_REGISTRO');
    });

    it('el personal registra lo que el cliente decidió, para ese cliente', () => {
      const decidir = spyOn((component as any).privacidadService, 'decidirPorElCliente').and.returnValues(
        of({ success: true, message: 'ok', data: estado('OTORGADO') }),
        of({ success: true, message: 'ok', data: estado('RETIRADO') }));
      spyOn((component as any).messageService, 'add');

      component.decidirIaCliente(true);
      expect(decidir).toHaveBeenCalledWith(7, 'USO_IA_CLINICA', true);
      expect(component.estadoIaCliente()).toBe('OTORGADO');

      component.decidirIaCliente(false);
      expect(decidir).toHaveBeenCalledWith(7, 'USO_IA_CLINICA', false);
      expect(component.estadoIaCliente()).toBe('RETIRADO');
    });

    it('sin permiso para modificar clientes no se registra nada', () => {
      (component.canClientAction as jasmine.Spy).and.returnValue(false);
      const decidir = spyOn((component as any).privacidadService, 'decidirPorElCliente');

      component.decidirIaCliente(true);

      expect(decidir).not.toHaveBeenCalled();
    });
  });
});
