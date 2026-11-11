export interface ReceivedTaxEvent {
  code: string;
  description: string;
  rut: string;
  dv: string;
  at: string;
}

export interface ReceivedTaxResult {
  code: number;
  description: string;
  events: ReceivedTaxEvent[];
}

export interface ReceivedTaxDocument {
  id: string;
  issuerRut: string;
  issuerName: string;
  receiverRut: string;
  kind: number;
  folio: number;
  issueDate: string;
  total: number;
  receivedAt: string;
  registry?: ReceivedTaxResult;
  lastCheckedAt?: string;
}

export interface ReceivedTaxPage {
  manualSync?: ReceivedSyncRequest | null;
  items: ReceivedTaxDocument[];
  nextCursor: string;
  sync: { lastSuccess: string };
  issues: { messageId: string; status: string; detail: string }[];
}

export interface ReceivedSyncRequest {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  requestedAt: string;
  startedAt: string;
  finishedAt: string;
  detail: string;
}

export interface ReceivedSyncAccepted {
  queued: boolean;
  request: ReceivedSyncRequest | null;
}

export interface ReceivedTaxResponse {
  document: ReceivedTaxDocument;
  result: ReceivedTaxResult;
  successful: boolean;
}
