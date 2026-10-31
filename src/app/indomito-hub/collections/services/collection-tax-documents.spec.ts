import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CollectionTaxDocuments } from './collection-tax-documents';

describe('CollectionTaxDocuments', () => {
  let service: CollectionTaxDocuments;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CollectionTaxDocuments);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta la cola por estado y registra sin enviar el monto desde el navegador', () => {
    service.list('PENDING', 'cursor').subscribe();
    const list = http.expectOne(
      `${environment.apiUrl}/pagos/documentos-tributarios/pendientes?status=PENDING&cursor=cursor`,
    );
    expect(list.request.method).toBe('GET');
    list.flush({ data: { items: [] } });

    const request = {
      commandId: 'command',
      folio: '123',
      issueDate: '2026-10-06',
      reason: 'Emisión revisada',
      pdfBase64: 'JVBERi0=',
    };
    service.recordManual('request/id', request).subscribe();
    const record = http.expectOne(
      `${environment.apiUrl}/pagos/documentos-tributarios/request%2Fid/emision-manual`,
    );
    expect(record.request.method).toBe('POST');
    expect(record.request.body).toEqual(request);
    expect(record.request.body.amount).toBeUndefined();
    record.flush({ data: { requestId: 'request/id' } });
  });

  it('combina solicitudes pendientes y registradas ordenadas desde la más reciente', () => {
    let requestIds: string[] = [];
    service.listAll().subscribe(page => requestIds = page.items.map(item => item.requestId));

    const requests = http.match(request =>
      request.url === `${environment.apiUrl}/pagos/documentos-tributarios/pendientes`,
    );
    expect(requests.length).toBe(2);
    const pending = requests.find(request => request.request.params.get('status') === 'PENDING');
    const recorded = requests.find(request => request.request.params.get('status') === 'RECORDED');
    pending?.flush({ data: { items: [{ requestId: 'older', requestedAt: '2026-10-29T12:00:00Z' }] } });
    recorded?.flush({ data: { items: [{ requestId: 'caso-1', requestedAt: '2026-10-30T21:01:32Z' }] } });

    expect(requestIds).toEqual(['caso-1', 'older']);
  });
});
