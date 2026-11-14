import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CategoriasProductoComponent } from './categorias-producto/categorias-producto.component';
import { ClientComponent } from './client/client.component';
import { ComplementarioComponent } from './complementario/complementario.component';
import { EmployeeComponent } from './employee/employee.component';
import { LotesComponent } from './lotes/lotes.component';
import { ProductosComponent } from './productos/productos.component';

interface Caso {
  nombre: string;
  clase: Type<unknown>;
  manejador: string;
  carga: string;
  conPaginaActual: boolean;
}

const CASOS: Caso[] = [
  { nombre: 'productos', clase: ProductosComponent, manejador: 'onPageChange', carga: 'loadProductos', conPaginaActual: false },
  { nombre: 'lotes', clase: LotesComponent, manejador: 'onPageChange', carga: 'loadLotes', conPaginaActual: false },
  { nombre: 'categorías de producto', clase: CategoriasProductoComponent, manejador: 'onCategoriasPageChange', carga: 'loadCategorias', conPaginaActual: false },
  { nombre: 'clientes', clase: ClientComponent, manejador: 'onClientPageChange', carga: 'loadClients', conPaginaActual: true },
  { nombre: 'empleados', clase: EmployeeComponent, manejador: 'onEmployeePageChange', carga: 'goToEmployeePage', conPaginaActual: true },
  { nombre: 'configuración complementaria', clase: ComplementarioComponent, manejador: 'onEspecialidadesPageChange', carga: 'loadEspecialidades', conPaginaActual: false }
];

for (const caso of CASOS) {
  describe(`Paginación con señales — ${caso.nombre}`, () => {
    let componente: any;
    let cargar: jasmine.Spy;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [caso.clase, HttpClientTestingModule, ReactiveFormsModule],
        providers: [provideRouter([]), MessageService, ConfirmationService]
      })
        .overrideComponent(caso.clase, { set: { template: '' } })
        .compileComponents();

      componente = TestBed.createComponent(caso.clase).componentInstance;
      cargar = spyOn(componente, caso.carga);
    });

    it('empieza con diez filas por página', () => {
      expect(componente.pageSize()).toBe(10);
      if (caso.conPaginaActual) expect(componente.currentPage()).toBe(0);
    });

    it('al cambiar el tamaño de página vuelve a la primera página', () => {
      componente[caso.manejador]({ rows: 20, page: 3 });

      expect(componente.pageSize()).toBe(20);
      expect(cargar).toHaveBeenCalledOnceWith(0);
    });

    it('con el mismo tamaño pide la página elegida', () => {
      componente[caso.manejador]({ rows: 10, page: 3 });

      expect(componente.pageSize()).toBe(10);
      expect(cargar).toHaveBeenCalledOnceWith(3);
    });

    it('sin tamaño en el evento usa diez filas', () => {
      componente[caso.manejador]({ page: 2 });

      expect(componente.pageSize()).toBe(10);
      expect(cargar).toHaveBeenCalledOnceWith(2);
    });
  });
}
