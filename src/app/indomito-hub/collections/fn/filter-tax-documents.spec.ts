import { describe, expect, it } from 'vitest';
import type { TaxDocumentRequest } from '../interfaces/tax-document.interface';
import {
  filterTaxDocuments,
  taxDocumentOrigin,
  taxDocumentUpdatedAt,
} from './filter-tax-documents';

const manual = taxDocument({
  requestId: 'manual',
  status: 'REJECTED',
  effectiveDate: '2026-11-01',
  grossAmount: 35000,
});
const khipu = taxDocument({
  requestId: 'khipu',
  receiptId: 'receipt-1',
  status: 'ACCEPTED',
  effectiveDate: '2026-11-03',
  grossAmount: 50000,
  siiIssuance: { folio: 393, trackId: '0263786180', processedAt: '2026-11-03T22:44:22Z' },
});

describe('filterTaxDocuments', () => {
  it('filtra por origen, estado, fecha y búsqueda tributaria', () => {
    expect(
      filterTaxDocuments([manual, khipu], {
        search: '393',
        status: 'ACCEPTED',
        origin: 'KHIPU',
        from: new Date(2026, 10, 2),
        to: new Date(2026, 10, 4),
      }),
    ).toEqual([khipu]);
    expect(taxDocumentOrigin(khipu)).toBe('KHIPU');
    expect(taxDocumentUpdatedAt(khipu)).toBe('2026-11-03T22:44:22Z');
  });
});

function taxDocument(overrides: Partial<TaxDocumentRequest>): TaxDocumentRequest {
  return {
    schemaVersion: 3,
    requestId: 'request',
    sourceEventId: 'event',
    receiptId: '',
    accountId: '',
    tripId: '',
    currency: 'CLP',
    grossAmount: 1000,
    effectiveDate: '2026-11-01',
    requestedAt: '2026-11-01T12:00:00Z',
    documentKind: 'BOLETA',
    documentSubtype: 'BOLETA_VENTA_ELECTRONICA',
    issuanceMode: 'SII_DIRECT',
    status: 'READY',
    ...overrides,
  };
}
