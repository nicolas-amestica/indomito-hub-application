import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReceiptApi } from './receipt-api';
import { environment } from '../../../../environments/environment';

describe('ReceiptApi', () => {
  let api: ReceiptApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ReceiptApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('lista comprobantes de una cuenta solo bajo autenticación administrativa', () => {
    api.list({ accountId: 'account' }, 'cursor').subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/pagos/cuentas/account/comprobantes?cursor=cursor`,
    );
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ data: { items: [] } });
  });
  it('deja la autenticación administrativa al interceptor', () => {
    api.download({ accountId: 'account' }, 'receipt').subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/pagos/cuentas/account/comprobantes/receipt/descarga`,
    );
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ data: { url: 'url', expiresIn: 120 } });
  });
  it('reenvía solo identificador de solicitud y correo como administrador', () => {
    const body = { commandId: 'command', email: 'other@example.test' };
    api.resend({ accountId: 'account' }, 'receipt', body).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/pagos/cuentas/account/comprobantes/receipt/reenvios`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ data: { status: 'QUEUED', deliveryId: 'delivery' } });
  });
});
