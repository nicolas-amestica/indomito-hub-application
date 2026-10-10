export interface CollectionSettlement {
  paymentReference: string;
  tripId: string;
  amount: number;
  settledGross: number;
  actualFees: number;
  version: number;
}

export interface SettlementPage {
  items: CollectionSettlement[];
  nextCursor?: string;
}

export interface ReconcileSettlementRequest {
  commandId: string;
  version: number;
  gross: number;
  fee: number;
  bankReference: string;
  effectiveDate: string;
  reason: string;
}

export interface CashPeriod {
  opening: number;
  inflows: number;
  outflows: number;
  closing: number;
}

export interface CashEntry {
  account: string;
  amount: number;
}

export interface CashEvent {
  commandId: string;
  type: string;
  amount: number;
  reference?: string;
  effectiveDate: string;
  entries: CashEntry[];
}

export interface TripCashView {
  period: CashPeriod;
  inTransit: number;
  actualFees: number;
  position: {
    receivable: number;
    depositReceivable: number;
    installmentReceivable: number;
    appliedReceipts: number;
    unappliedReceipts: number;
    discounts: number;
    cancelled: number;
    refundPayable: number;
    refunded: number;
  };
  suppliers: { committedPending: number; refundExpected: number };
  events: CashEvent[];
}

export interface SupplierCommitment {
  id: string;
  tripId: string;
  name: string;
  service: string;
  version: number;
  committed: number;
  paid: number;
  refundAgreed: number;
  refundReceived: number;
}

export interface SupplierPage {
  items: SupplierCommitment[];
  nextCursor?: string;
}

export type SupplierOperationType = 'CREATE' | 'REVISE' | 'PAY' | 'RECEIVE_REFUND';

export interface SupplierOperationRequest {
  commandId: string;
  version: number;
  operation: SupplierOperationType;
  name?: string;
  service?: string;
  committed?: number;
  refundAgreed?: number;
  amount?: number;
  reference?: string;
  effectiveDate?: string;
  annexId?: string;
  reason: string;
}

export interface ConsolidatedTripCash {
  tripId: string;
  inflows: number;
  outflows: number;
  net: number;
  actualFees: number;
}

export interface ConsolidatedCashView {
  from: string;
  to: string;
  inflows: number;
  outflows: number;
  net: number;
  actualFees: number;
  trips: ConsolidatedTripCash[];
}

export interface RefundRow {
  accountId: string;
  name: string;
  document: string;
  active: boolean;
  paidInstallments: number;
  withdrawalRefundApproved: number;
  unappliedReceived: number;
  unappliedRefundApproved: number;
  refunded: number;
  refundPayable: number;
  version: number;
}

export interface RefundPage {
  items: RefundRow[];
  nextCursor?: string;
}

export interface CollectionAlertView {
  asOf: string;
  departureDate?: string;
  cutoffDate?: string;
  travelDateDefined: boolean;
  overdue: number;
  outstanding: number;
  dueByCutoff: number;
  accounts: Array<{
    accountId: string;
    name: string;
    overdue: number;
    outstanding: number;
    nextDueDate?: string;
  }>;
}

export interface GlobalCollectionAlertView {
  year: string;
  asOf: string;
  overdue: number;
  outstanding: number;
  groups: Array<
    CollectionAlertView & { tripId: string; institutionName: string; destination: string }
  >;
}

export interface OperationRecovery {
  status: 'APPLIED';
  kind: 'ACCOUNT' | 'SUPPLIER' | 'SETTLEMENT';
  commandId: string;
  event: CashEvent;
  supplier?: SupplierCommitment;
  settlement?: CollectionSettlement;
}
