import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ContractsService } from './contracts.service';

describe('ContractsService amendments', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  it('creates an amendment without financial fields', () => {
    const request = {
      id: 'annex',
      baseContractVersion: 4,
      reason: 'Definir fechas',
      after: {
        departureDate: '2027-10-05',
        returnDate: '2027-10-08',
        days: 4,
        nights: 3,
        services: [{ description: 'Transporte' }],
      },
    };
    TestBed.inject(ContractsService).createAmendment('contract/a', request).subscribe();
    const http = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/contratos/contract%2Fa/anexos`,
    );
    expect(http.request.method).toBe('POST');
    expect(http.request.body).toEqual(request);
    expect(JSON.stringify(http.request.body)).not.toContain('payments');
    http.flush({ data: { ...request, contractId: 'contract/a', version: 1, status: 'DRAFT' } });
  });

  it('approves and downloads only the selected amendment', () => {
    const service = TestBed.inject(ContractsService);
    service.approveAmendment('contract/a', 'annex/b', 1).subscribe();
    let http = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/contratos/contract%2Fa/anexos/annex%2Fb/aprobacion`,
    );
    expect(http.request.body).toEqual({ version: 1 });
    http.flush({ data: { id: 'annex/b', status: 'APPROVED' } });
    service.getApprovedAmendmentPdf('contract/a', 'annex/b').subscribe();
    http = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/contratos/contract%2Fa/anexos/annex%2Fb/pdf`,
    );
    expect(http.request.method).toBe('GET');
    http.flush({ data: { url: 'https://example.test/document', expiresAt: '2026-10-05' } });
  });

  it('prepares, finalizes and reads signed contract versions by contract key', () => {
    const service = TestBed.inject(ContractsService);
    const controller = TestBed.inject(HttpTestingController);
    const preparation = {
      clientRequestId: 'request-1234',
      size: 100,
      sha256: 'a'.repeat(64),
      currentDocumentId: '',
      replacementReason: '',
      confirmsAllSignatures: true,
    };

    service.prepareSignedDocument('contract/a', preparation).subscribe();
    let http = controller.expectOne(
      `${environment.apiUrl}/contratos/contract%2Fa/documentos-firmados:carga`,
    );
    expect(http.request.method).toBe('POST');
    expect(http.request.body).toEqual(preparation);
    http.flush({
      data: { clientRequestId: preparation.clientRequestId, uploadUrl: 'https://s3.test' },
    });

    service.finalizeSignedDocument('contract/a', preparation.clientRequestId).subscribe();
    http = controller.expectOne(
      `${environment.apiUrl}/contratos/contract%2Fa/documentos-firmados:confirmar`,
    );
    expect(http.request.body).toEqual({ clientRequestId: preparation.clientRequestId });
    http.flush({ data: { id: preparation.clientRequestId } });

    service.listSignedDocuments('contract/a').subscribe();
    http = controller.expectOne(`${environment.apiUrl}/contratos/contract%2Fa/documentos-firmados`);
    expect(http.request.method).toBe('GET');
    http.flush({ data: { items: [] } });

    service.getSignedDocumentPdf('contract/a', preparation.clientRequestId).subscribe();
    http = controller.expectOne(
      `${environment.apiUrl}/contratos/contract%2Fa/documentos-firmados/request-1234/pdf`,
    );
    expect(http.request.method).toBe('GET');
    http.flush({ data: { url: 'https://example.test/signed', expiresAt: '2026-10-07' } });
  });
});
