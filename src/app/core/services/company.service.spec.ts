import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CompanyService } from './company.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CompanyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('limita el tamaño de página al máximo aceptado por el backend', () => {
    service.listar(0, 1000).subscribe();

    const request = http.expectOne(
      req => req.url === `${environment.apiUrl}/admin/company/list`
        && req.params.get('page') === '0'
        && req.params.get('size') === '100'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'ok', data: { content: [] } });
  });
});
