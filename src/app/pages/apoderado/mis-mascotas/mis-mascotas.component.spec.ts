import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisMascotasComponent } from './mis-mascotas.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';

describe('MisMascotasComponent', () => {
  let component: MisMascotasComponent;
  let fixture: ComponentFixture<MisMascotasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisMascotasComponent, HttpClientTestingModule],
      providers: [MessageService]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MisMascotasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
