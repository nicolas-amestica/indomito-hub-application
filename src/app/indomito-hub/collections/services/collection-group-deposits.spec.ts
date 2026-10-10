import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { CollectionGroupDeposits } from './collection-group-deposits';

describe('CollectionGroupDeposits', () => {
  it('codifica la gira y conserva el commandId publico para recuperar la operacion', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionGroupDeposits);
    const http = TestBed.inject(HttpTestingController);
    const request = {
      commandId: '01ABCDEFGHJKMNPQRSTVWXYZ12',
      amount: 300000,
      reference: 'CARTOLA-123',
      effectiveDate: '2026-10-05',
      email: 'cobranza@example.com',
      reason: 'Ingreso verificado en cartola',
    };
    api.create('trip/a', request).subscribe();
    http
      .expectOne(`${environment.apiUrl}/pagos/giras/trip%2Fa/abonos-grupales`)
      .flush({
        data: {
          id: 'internal',
          tripId: 'trip/a',
          status: 'APPLIED',
          amount: 300000,
          prepared: 2,
          applied: 2,
          expected: 2,
        },
      });
    api.get('trip/a', request.commandId).subscribe();
    http
      .expectOne(`${environment.apiUrl}/pagos/giras/trip%2Fa/abonos-grupales/${request.commandId}`)
      .flush({
        data: {
          id: 'internal',
          tripId: 'trip/a',
          status: 'APPLIED',
          amount: 300000,
          prepared: 2,
          applied: 2,
          expected: 2,
        },
      });
    http.verify();
  });
});
