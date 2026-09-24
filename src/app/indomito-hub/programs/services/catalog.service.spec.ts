import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtiene y desenvuelve los catálogos consolidados', () => {
    const catalogs = {
      plans: [{ id: 'plan', display: 'Gira de estudio', order: 1 }],
      seasons: [{ id: '2027', display: '2027', order: 1 }],
      destinations: [
        {
          id: 'BRF',
          display: 'Florianópolis',
          order: 1,
          budgetTemplateId: 'brochure-default',
        },
      ],
      settings: {},
    };
    let received: unknown;

    service.getCatalogs().subscribe((value) => (received = value));
    const request = http.expectOne(`${environment.apiUrl}/catalogos`);
    expect(request.request.method).toBe('GET');
    request.flush({ data: catalogs });

    expect(received).toEqual(catalogs);
  });
});
