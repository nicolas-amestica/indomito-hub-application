import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { CollectionTreasury } from './collection-treasury';

describe('CollectionTreasury', () => {
  it('codifica claves y conserva el contrato de conciliacion', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionTreasury);
    const http = TestBed.inject(HttpTestingController);
    const request = {
      commandId: 'command',
      version: 1,
      gross: 1000,
      fee: 20,
      bankReference: 'cartola-1',
      effectiveDate: '2026-10-05',
      reason: 'Cartola revisada',
    };
    api.reconcile('trip/a', 'khipu:payment/a', request).subscribe();
    const call = http.expectOne(
      `${environment.apiUrl}/pagos/tesoreria/giras/trip%2Fa/liquidaciones/payment%2Fa`,
    );
    expect(call.request.body).toBe(request);
    call.flush({ data: { settlement: {} } });
    http.verify();
  });

  it('envia la operacion de proveedor a la gira y proveedor exactos', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionTreasury);
    const http = TestBed.inject(HttpTestingController);
    const request = {
      commandId: 'command',
      version: 1,
      operation: 'PAY' as const,
      amount: 5000,
      reference: 'cartola-1',
      effectiveDate: '2026-10-05',
      reason: 'Pago revisado',
    };
    api.operateSupplier('trip/a', 'supplier/a', request).subscribe();
    const call = http.expectOne(
      `${environment.apiUrl}/pagos/tesoreria/giras/trip%2Fa/proveedores/supplier%2Fa`,
    );
    expect(call.request.body).toBe(request);
    call.flush({ data: { supplier: {} } });
    http.verify();
  });

  it('consulta el consolidado solo por rango acotado', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionTreasury);
    const http = TestBed.inject(HttpTestingController);
    api.getConsolidatedCash('2026-09-01', '2026-10-05').subscribe();
    const call = http.expectOne(
      `${environment.apiUrl}/pagos/tesoreria/caja?from=2026-09-01&to=2026-10-05`,
    );
    expect(call.request.method).toBe('GET');
    call.flush({ data: { trips: [] } });
    http.verify();
  });

  it('pagina devoluciones solo dentro de la gira', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionTreasury);
    const http = TestBed.inject(HttpTestingController);
    api.listRefunds('trip/a', 'account/a').subscribe();
    const call = http.expectOne(
      `${environment.apiUrl}/pagos/tesoreria/giras/trip%2Fa/devoluciones?cursor=account/a`,
    );
    expect(call.request.method).toBe('GET');
    call.flush({ data: { items: [] } });
    http.verify();
  });

  it('consulta alertas globales en una sola solicitud anual', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionTreasury);
    const http = TestBed.inject(HttpTestingController);
    api.getGlobalAlerts(2027, '2027-02-01').subscribe();
    const call = http.expectOne(
      `${environment.apiUrl}/pagos/tesoreria/alertas?year=2027&asOf=2027-02-01`,
    );
    expect(call.request.method).toBe('GET');
    call.flush({ data: { groups: [] } });
    http.verify();
  });

  it('recupera una operacion por clave cliente y alcance', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CollectionTreasury);
    const http = TestBed.inject(HttpTestingController);
    api.recoverOperation('command/a', 'SUPPLIER', 'supplier/a', 'trip/a').subscribe();
    const call = http.expectOne(
      `${environment.apiUrl}/pagos/operaciones/command%2Fa?kind=SUPPLIER&entityId=supplier/a&tripId=trip/a`,
    );
    expect(call.request.method).toBe('GET');
    call.flush({ data: { status: 'APPLIED' } });
    http.verify();
  });
});
