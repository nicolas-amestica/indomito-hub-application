import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { CollectionReceiptFailures } from './collection-receipt-failures';

describe('CollectionReceiptFailures', () => {
  it('consulta una particion diaria y reintenta la entrega exacta', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionReceiptFailures);
    const http = TestBed.inject(HttpTestingController);
    api.list('2026-10-05', 'cursor').subscribe();
    const list = http.expectOne(
      `${environment.apiUrl}/pagos/comprobantes/fallos?date=2026-10-05&cursor=cursor`,
    );
    expect(list.request.method).toBe('GET');
    list.flush({ data: { items: [] } });
    const request = { commandId: 'command', deliveryId: 'delivery', reason: 'Correo verificado' };
    api.retry('receipt/a', request).subscribe();
    const retry = http.expectOne(
      `${environment.apiUrl}/pagos/comprobantes/fallos/receipt%2Fa/reintentos`,
    );
    expect(retry.request.body).toBe(request);
    retry.flush({ data: { receiptId: 'receipt/a' } });
    http.verify();
  });
});
