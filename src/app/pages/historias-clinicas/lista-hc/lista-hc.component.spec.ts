import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaHcComponent } from './lista-hc.component';

describe('ListaHcComponent', () => {
  let component: ListaHcComponent;
  let fixture: ComponentFixture<ListaHcComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaHcComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ListaHcComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
