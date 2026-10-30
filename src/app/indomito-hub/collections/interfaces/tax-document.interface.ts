export type TaxDocumentListStatus = 'PENDING' | 'RECORDED';

export interface TaxDocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
  exempt: boolean;
  unit?: string;
}

export interface ManualTaxIssuance {
  folio: string;
  issueDate: string;
  documentKey: string;
  documentSha256: string;
  audit: { actor: string; reason: string; recordedAt: string };
}

export interface TaxDocumentRequest {
  schemaVersion: number;
  requestId: string;
  sourceEventId: string;
  receiptId: string;
  accountId: string;
  tripId: string;
  currency: 'CLP';
  grossAmount: number;
  effectiveDate: string;
  requestedAt: string;
  documentKind: 'BOLETA';
  documentSubtype: 'BOLETA_VENTA_ELECTRONICA';
  issuanceMode: 'MANUAL_SII' | 'SII_DIRECT';
  status: 'PENDING_MANUAL_ISSUE' | 'MANUAL_RECORDED' | 'READY' | 'ISSUING' | 'SUBMITTED';
  manualIssuance?: ManualTaxIssuance;
  siiIssuance?: { folio: number; trackId?: string; submittedAt?: string };
  items?: TaxDocumentItem[];
  reference?: string;
  customerRut?: string;
}

export interface CreateTaxDocumentRequest {
  commandId: string;
  issueDate: string;
  customerRut: string;
  reference: string;
  items: TaxDocumentItem[];
}

export interface TaxDocumentPage {
  items: TaxDocumentRequest[];
  nextCursor?: string;
}

export interface ManualTaxIssuanceRequest {
  commandId: string;
  folio: string;
  issueDate: string;
  reason: string;
  pdfBase64: string;
}
