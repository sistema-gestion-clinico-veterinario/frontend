import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComplementarioComponent } from './complementario.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { ReactiveFormsModule } from '@angular/forms';

describe('ComplementarioComponent', () => {
  let component: ComplementarioComponent;
  let fixture: ComponentFixture<ComplementarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplementarioComponent, HttpClientTestingModule, ReactiveFormsModule],
      providers: [MessageService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComplementarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
