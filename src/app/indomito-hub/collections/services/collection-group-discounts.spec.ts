import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { CollectionGroupDiscounts } from './collection-group-discounts';

describe('CollectionGroupDiscounts', () => {
  it('separa borrador, recuperación y aprobación', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionGroupDiscounts);
    const http = TestBed.inject(HttpTestingController);
    const base = `${environment.apiUrl}/pagos/giras/trip%2Fa/descuentos`;
    const draft = { id: 'draft', accountIds: [], basisPoints: 1000, reason: 'Motivo valido' };
    api.create('trip/a', draft).subscribe();
    http.expectOne(base).flush({ data: {} });
    api.get('trip/a', 'draft/b').subscribe();
    http.expectOne(`${base}/draft%2Fb`).flush({ data: {} });
    api
      .approve('trip/a', 'draft/b', { commandId: 'approval', reason: 'Revision completa' })
      .subscribe();
    http.expectOne(`${base}/draft%2Fb/aprobacion`).flush({ data: {} });
    http.verify();
  });
});
