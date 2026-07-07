import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduleManagementComponent } from './schedule-management.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MessageService, ConfirmationService } from 'primeng/api';

describe('ScheduleManagementComponent', () => {
  let component: ScheduleManagementComponent;
  let fixture: ComponentFixture<ScheduleManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleManagementComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [MessageService, ConfirmationService],
    })
    .overrideComponent(ScheduleManagementComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ScheduleManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
