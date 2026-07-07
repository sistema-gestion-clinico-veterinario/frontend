import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApoderadoPortalComponent } from './apoderado-portal.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ApoderadoPortalComponent', () => {
  let component: ApoderadoPortalComponent;
  let fixture: ComponentFixture<ApoderadoPortalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApoderadoPortalComponent, HttpClientTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } }, params: of({}), queryParams: of({}) } },
      ],
    })
    .overrideComponent(ApoderadoPortalComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(ApoderadoPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
