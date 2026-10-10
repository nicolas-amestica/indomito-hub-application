import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { CollectionTripAccess } from './collection-trip-access';

describe('CollectionTripAccess', () => {
  it('consulta y cambia solamente el acceso de la gira indicada', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionTripAccess);
    const http = TestBed.inject(HttpTestingController);

    api.get('trip/a').subscribe();
    const get = http.expectOne(`${environment.apiUrl}/pagos/giras/trip%2Fa/acceso`);
    expect(get.request.method).toBe('GET');
    get.flush({ data: { tripId: 'trip/a', version: 1, status: 'ACTIVE' } });

    const request = { commandId: 'command-1', reason: 'Cambio autorizado', version: 1 };
    api.change('trip/a', 'rotate', request).subscribe();
    const rotate = http.expectOne(`${environment.apiUrl}/pagos/giras/trip%2Fa/acceso/rotate`);
    expect(rotate.request.method).toBe('POST');
    expect(rotate.request.body).toBe(request);
    rotate.flush({ data: { tripId: 'trip/a', tripCode: 'ABC234', version: 2, status: 'ACTIVE' } });
    http.verify();
  });
});
