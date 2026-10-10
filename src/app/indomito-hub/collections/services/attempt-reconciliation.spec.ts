import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { AttemptReconciliation } from './attempt-reconciliation';
describe('AttemptReconciliation', () => {
  it('codifica el intento y no obtiene estado desde el navegador', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(AttemptReconciliation);
    const http = TestBed.inject(HttpTestingController);
    const request = {
      commandId: 'command',
      paymentId: 'abc123def456',
      reason: 'Revision autoritativa',
    };
    api.reconcile('attempt/a', request).subscribe();
    const call = http.expectOne(`${environment.apiUrl}/pagos/intentos/attempt%2Fa/conciliacion`);
    if (call.request.body !== request) throw new Error('request replaced');
    call.flush({ data: {} });
    http.verify();
  });
});
