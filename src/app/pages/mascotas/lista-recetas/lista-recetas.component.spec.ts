import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaRecetasComponent } from './lista-recetas.component';
import { HistoriaClinicaService } from '../../../core/services/historia-clinica.service';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ListaRecetasComponent', () => {
  let component: ListaRecetasComponent;
  let fixture: ComponentFixture<ListaRecetasComponent>;
  let hcService: jasmine.SpyObj<HistoriaClinicaService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('HistoriaClinicaService', ['buscarRecetas']);

    await TestBed.configureTestingModule({
      imports: [ListaRecetasComponent, HttpClientTestingModule],
      providers: [
        { provide: HistoriaClinicaService, useValue: spy }
      ]
    }).compileComponents();

    hcService = TestBed.inject(HistoriaClinicaService) as jasmine.SpyObj<HistoriaClinicaService>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaRecetasComponent);
    component = fixture.componentInstance;
    
    hcService.buscarRecetas.and.returnValue(of({
      success: true,
      message: 'OK',
      data: {
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 10,
        number: 0,
        numberOfElements: 0,
        first: true,
        last: true,
        empty: true
      }
    }));
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load recetas on init', () => {
    expect(hcService.buscarRecetas).toHaveBeenCalled();
  });

  it('should reset filters and reload', () => {
    component.searchQuery = 'test';
    component.resetFiltros();
    expect(component.searchQuery).toBe('');
    expect(hcService.buscarRecetas).toHaveBeenCalledWith(jasmine.objectContaining({ query: '' }), 0, 10);
  });
});
