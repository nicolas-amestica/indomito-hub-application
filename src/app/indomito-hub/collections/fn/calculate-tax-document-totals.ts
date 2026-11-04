import type { TaxDocumentItem } from '../interfaces/tax-document.interface';

export interface TaxDocumentTotals {
  readonly net: number;
  readonly vat: number;
  readonly exempt: number;
  readonly gross: number;
}

export function calculateTaxDocumentTotals(
  items: ReadonlyArray<Partial<TaxDocumentItem> | null | undefined>,
): TaxDocumentTotals {
  let net = 0;
  let vat = 0;
  let exempt = 0;

  for (const item of items) {
    const gross = Number(item?.quantity ?? 0) * Number(item?.unitPrice ?? 0);
    if (!Number.isFinite(gross) || gross <= 0) continue;
    if (item?.exempt) {
      exempt += gross;
      continue;
    }
    const lineNet = Math.floor((gross * 100 + 59) / 119);
    net += lineNet;
    vat += gross - lineNet;
  }

  return { net, vat, exempt, gross: net + vat + exempt };
}
