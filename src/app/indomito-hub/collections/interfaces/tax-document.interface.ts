export type TaxDocumentListStatus = 'PENDING' | 'RECORDED';

export type TaxDocumentStatus =
  | 'PENDING_MANUAL_ISSUE'
  | 'MANUAL_RECORDED'
  | 'READY'
  | 'ISSUING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'ACCEPTED_WITH_REPAIRS'
  | 'REJECTED';

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
  status: TaxDocumentStatus;
  manualIssuance?: ManualTaxIssuance;
  siiIssuance?: { folio: number; trackId?: string; submittedAt?: string; processedAt?: string; status?: string; detail?: string; documentKey?: string };
  items?: TaxDocumentItem[];
  reference?: string;
  customerRut?: string;
  deliveryEmail?: string;
  reissuesRequest?: string;
  reissuedBy?: string;
}

export interface CreateTaxDocumentRequest {
  commandId: string;
  issueDate: string;
  customerRut: string;
  deliveryEmail?: string;
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

export interface TaxConfigurationInput {
  senderRut: string;
  issuerName: string;
  issuerActivity: string;
  issuerAddress: string;
  issuerCommune: string;
  notificationEmail: string;
  environment: 'CERTIFICATION' | 'PRODUCTION';
  resolutionDate: string;
  resolutionNumber: number;
  enabled: boolean;
  certificationApproved: boolean;
}

export interface TaxConfigurationSummary extends TaxConfigurationInput {
  caf: {
    from: number;
    to: number;
    used: number;
    available: number;
    next: number | null;
    usagePercentage: number;
    authorizationDate: string;
    severity: 'MISSING' | 'OK' | 'LOW' | 'EXHAUSTED';
  };
  certificate: {
    subject: string;
    validFrom: string;
    validTo: string;
    daysUntilExpiry: number;
    severity: 'MISSING' | 'OK' | 'EXPIRING' | 'EXPIRED';
  };
}
