import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyScheduleComponent } from './my-schedule.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MyScheduleComponent', () => {
  let component: MyScheduleComponent;
  let fixture: ComponentFixture<MyScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyScheduleComponent, HttpClientTestingModule],
    })
    .overrideComponent(MyScheduleComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(MyScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
