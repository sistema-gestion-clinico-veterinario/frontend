import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable, of, throwError } from 'rxjs';
import { ProductoFormComponent } from './producto-form.component';
import { ProductoService } from '../../../../core/services/producto.service';
import { CategoriaProductoService } from '../../../../core/services/categoria-producto.service';
import { UnidadMedidaService } from '../../../../core/services/unidad-medida.service';
import { MarcaProductoService } from '../../../../core/services/marca-producto.service';
import { AuthStore } from '../../../../store/auth.store';

describe('ProductoFormComponent - producto que no se puede abrir', () => {
  let router: jasmine.SpyObj<Router>;

  function crear(respuesta: Observable<unknown>) {
    const producto = jasmine.createSpyObj('ProductoService', ['obtener']);
    producto.obtener.and.returnValue(respuesta);
    router = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']);
    const catalogo = { listarActivas: () => of({ data: [] }) };
    TestBed.configureTestingModule({
      imports: [ProductoFormComponent],
      providers: [
        { provide: ProductoService, useValue: producto },
        { provide: CategoriaProductoService, useValue: catalogo },
        { provide: UnidadMedidaService, useValue: catalogo },
        { provide: MarcaProductoService, useValue: catalogo },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: { add: jasmine.createSpy('add') } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'PRD-AJENO' }, queryParamMap: { get: () => null }, data: { modo: 'detalle' } } }
        },
        { provide: AuthStore, useValue: { companyId: () => 7, selectedEnterprise: () => null, hasAccess: () => true } }
      ]
    });
    const fixture = TestBed.createComponent(ProductoFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('un producto inexistente o de otra clínica muestra el aviso y oculta el formulario', () => {
    const fixture = crear(throwError(() => ({ status: 404 })));
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.errorCarga()).toBe('NO_ENCONTRADO');
    expect(el.textContent).toContain('No encontramos este producto');
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).not.toContain('Editar producto');
  });

  it('sin permiso lo indica y un fallo del servidor permite reintentar', () => {
    const sinPermiso = crear(throwError(() => ({ status: 403 })));
    expect(sinPermiso.componentInstance.errorCarga()).toBe('SIN_PERMISO');
    expect((sinPermiso.nativeElement as HTMLElement).textContent).toContain('No tienes acceso a este producto');

    TestBed.resetTestingModule();
    const fallo = crear(throwError(() => ({ status: 500 })));
    expect(fallo.componentInstance.errorCarga()).toBe('FALLO');
    expect((fallo.nativeElement as HTMLElement).textContent).toContain('Reintentar');
  });

  it('el botón volver regresa a la lista de productos', () => {
    const fixture = crear(throwError(() => ({ status: 404 })));
    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    botones.find(b => (b.textContent ?? '').includes('Volver a productos'))!.click();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/productos']);
  });
});
