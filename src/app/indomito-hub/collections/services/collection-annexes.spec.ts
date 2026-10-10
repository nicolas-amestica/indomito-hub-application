import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CollectionAnnexes } from './collection-annexes';

describe('CollectionAnnexes', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  it('encodes trip and cursor when listing the roster', () => {
    TestBed.inject(CollectionAnnexes).roster('trip/a', 'member/b').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/pagos/giras/trip%2Fa/pasajeros?cursor=member/b`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { items: [] } });
  });

  it('sends approval only to the selected annex', () => {
    TestBed.inject(CollectionAnnexes).apply('trip/a', 'annex/b', 'command', 'reason').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/pagos/giras/trip%2Fa/anexos/annex%2Fb/aplicacion`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ commandId: 'command', reason: 'reason' });
    request.flush({ data: { id: 'annex/b', tripId: 'trip/a', status: 'APPLIED' } });
  });

  it('migrates a historical roster without accepting passenger data', () => {
    TestBed.inject(CollectionAnnexes)
      .migrateRoster('trip/a', 'command', 'Migración revisada')
      .subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/pagos/giras/trip%2Fa/pasajeros/migracion`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ commandId: 'command', reason: 'Migración revisada' });
    request.flush({ data: { tripId: 'trip/a', status: 'APPLIED', prepared: 2, expected: 2 } });
  });

  it('closes only the selected roster with an idempotency key and reason', () => {
    TestBed.inject(CollectionAnnexes)
      .closeRoster('trip/a', 'command', 'Nómina definitiva revisada')
      .subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/pagos/giras/trip%2Fa/pasajeros/cierre`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      commandId: 'command',
      reason: 'Nómina definitiva revisada',
    });
    request.flush({ data: { tripId: 'trip/a', closed: true } });
  });
});
