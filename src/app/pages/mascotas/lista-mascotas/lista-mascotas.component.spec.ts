import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaMascotasComponent } from './lista-mascotas.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { map, of, throwError, timer } from 'rxjs';
import { MascotaService } from '../../../core/services/mascota.service';

describe('ListaMascotasComponent', () => {
  let component: ListaMascotasComponent;
  let fixture: ComponentFixture<ListaMascotasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaMascotasComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } }, params: of({}), queryParams: of({}), queryParamMap: of({ get: () => null }) } },
      ],
    })
    .overrideComponent(ListaMascotasComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ListaMascotasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('exportar a Excel', () => {
    let listar: jasmine.Spy;
    let crearUrl: jasmine.Spy;
    let mensajes: jasmine.Spy;

    const mascotas = (total: number) => Array.from({ length: total }, (_, i) => ({
      id: i + 1, nombreCompleto: `Mascota ${i + 1}`, especie: 'PERRO', activo: true
    }));

    const simularServidor = (total: number) => {
      const todas = mascotas(total);
      listar.and.callFake((_empresa: unknown, _nombre: unknown, _especie: unknown, pagina: number, tamano: number) => {
        const desde = pagina * tamano;
        return of({ data: { content: todas.slice(desde, desde + tamano), page: { totalPages: Math.ceil(total / tamano), totalElements: total } } });
      });
    };

    beforeEach(() => {
      listar = spyOn(TestBed.inject(MascotaService), 'listar');
      crearUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:prueba');
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');
      mensajes = spyOn((component as any).messageService, 'add');
    });

    it('pide las mascotas de 100 en 100 para reducir las peticiones', async () => {
      simularServidor(250);

      await component.descargarMascotas();

      expect(listar).toHaveBeenCalledTimes(3);
      expect(listar.calls.allArgs().map(argumentos => argumentos[4])).toEqual([100, 100, 100]);
    });

    it('recorre todas las páginas en orden', async () => {
      simularServidor(250);

      await component.descargarMascotas();

      expect(listar.calls.allArgs().map(argumentos => argumentos[3])).toEqual([0, 1, 2]);
    });

    it('con una sola página hace una sola petición y genera el archivo', async () => {
      simularServidor(40);

      await component.descargarMascotas();

      expect(listar).toHaveBeenCalledTimes(1);
      expect(crearUrl).toHaveBeenCalledTimes(1);
    });

    it('un segundo clic mientras exporta no repite las peticiones', async () => {
      simularServidor(250);

      const primera = component.descargarMascotas();
      const segunda = component.descargarMascotas();
      await Promise.all([primera, segunda]);

      expect(listar).toHaveBeenCalledTimes(3);
      expect(crearUrl).toHaveBeenCalledTimes(1);
    });

    it('marca que está exportando y lo libera al terminar', async () => {
      simularServidor(40);

      const exportacion = component.descargarMascotas();
      expect(component.exportando()).toBeTrue();
      await exportacion;

      expect(component.exportando()).toBeFalse();
    });

    it('si el servidor falla avisa, libera el botón y permite reintentar', async () => {
      listar.and.returnValue(throwError(() => new Error('caído')));

      await component.descargarMascotas();

      expect(mensajes).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
      expect(component.exportando()).toBeFalse();

      simularServidor(40);
      await component.descargarMascotas();
      expect(crearUrl).toHaveBeenCalledTimes(1);
    });

    it('con una clínica enorme descarga hasta el tope y avisa que fue parcial', async () => {
      simularServidor(30000);

      await component.descargarMascotas();

      expect(listar).toHaveBeenCalledTimes(200);
      expect(crearUrl).toHaveBeenCalledTimes(1);
      expect(mensajes).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Descarga parcial' }));
    });

    it('dentro del tope no avisa de descarga parcial', async () => {
      simularServidor(250);

      await component.descargarMascotas();

      expect(mensajes).not.toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Descarga parcial' }));
    });

    it('si se sale de la pantalla a mitad de la descarga no sigue pidiendo ni genera el archivo', async () => {
      const todas = mascotas(5000);
      listar.and.callFake((_e: unknown, _n: unknown, _s: unknown, pagina: number, tamano: number) =>
        timer(5).pipe(map(() => ({ data: { content: todas.slice(pagina * tamano, (pagina + 1) * tamano), page: { totalPages: 50, totalElements: 5000 } } }))));

      const exportacion = component.descargarMascotas();
      await new Promise(resolver => setTimeout(resolver, 18));
      fixture.destroy();
      const pedidasAlSalir = listar.calls.count();
      await exportacion;
      await new Promise(resolver => setTimeout(resolver, 40));

      expect(listar.calls.count()).toBe(pedidasAlSalir);
      expect(pedidasAlSalir).toBeLessThan(50);
      expect(crearUrl).not.toHaveBeenCalled();
      expect(mensajes).not.toHaveBeenCalled();
    });

    it('sin mascotas avisa y no genera el archivo', async () => {
      simularServidor(0);

      await component.descargarMascotas();

      expect(listar).toHaveBeenCalledTimes(1);
      expect(crearUrl).not.toHaveBeenCalled();
      expect(mensajes).toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Sin registros' }));
    });
  });
});
