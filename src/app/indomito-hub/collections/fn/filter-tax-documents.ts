import type { TaxDocumentRequest, TaxDocumentStatus } from '../interfaces/tax-document.interface';

export type TaxDocumentOrigin = 'ALL' | 'KHIPU' | 'MANUAL';

export interface TaxDocumentFilters {
  search: string;
  status: TaxDocumentStatus | 'ALL';
  origin: TaxDocumentOrigin;
  from: Date | null;
  to: Date | null;
}

export function taxDocumentOrigin(item: TaxDocumentRequest): Exclude<TaxDocumentOrigin, 'ALL'> {
  return item.receiptId ? 'KHIPU' : 'MANUAL';
}

export function taxDocumentUpdatedAt(item: TaxDocumentRequest): string {
  return item.siiIssuance?.processedAt ?? item.siiIssuance?.submittedAt ?? item.requestedAt;
}

export function filterTaxDocuments(
  items: readonly TaxDocumentRequest[],
  filters: TaxDocumentFilters,
): TaxDocumentRequest[] {
  const search = filters.search.trim().toLocaleLowerCase('es-CL');
  const from = filters.from ? localDateOnly(filters.from) : '';
  const to = filters.to ? localDateOnly(filters.to) : '';

  return items.filter((item) => {
    if (filters.status !== 'ALL' && item.status !== filters.status) return false;
    if (filters.origin !== 'ALL' && taxDocumentOrigin(item) !== filters.origin) return false;
    if (from && item.effectiveDate < from) return false;
    if (to && item.effectiveDate > to) return false;
    if (!search) return true;

    return [item.siiIssuance?.folio, item.siiIssuance?.trackId, item.receiptId, item.customerRut]
      .filter((value) => value !== undefined && value !== '')
      .some((value) => String(value).toLocaleLowerCase('es-CL').includes(search));
  });
}

function localDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
