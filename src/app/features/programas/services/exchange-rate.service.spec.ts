import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ExchangeRateService } from './exchange-rate.service';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExchangeRateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtiene y desenvuelve el snapshot de tipos de cambio', () => {
    const snapshot = {
      date: '2026-09-14',
      usdToClp: 950,
      brlToClp: 178,
      isFallback: false,
      source: 'banco-central',
    };
    let received: unknown;

    service.getSnapshot().subscribe((value) => (received = value));
    const request = http.expectOne(`${environment.apiUrl}/tasas-cambio`);
    expect(request.request.method).toBe('GET');
    request.flush({ data: snapshot });

    expect(received).toEqual(snapshot);
  });
});
