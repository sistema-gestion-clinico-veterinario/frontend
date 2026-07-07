import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaHcComponent } from './lista-hc.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ListaHcComponent', () => {
  let component: ListaHcComponent;
  let fixture: ComponentFixture<ListaHcComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaHcComponent, HttpClientTestingModule],
    })
    .overrideComponent(ListaHcComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ListaHcComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
