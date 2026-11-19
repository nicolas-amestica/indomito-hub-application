import type { ChargeType, CurrencyCode } from '../../programs/interfaces/program.interface';
import type { TaxSettings } from '../../../core/configuration/app-configuration.service';
import type { SupplierCommitment } from '../../collections/interfaces/collection-treasury.interface';
import type { FavoriteContent } from '../../programs/interfaces/favorite.interface';

/** Entradas persistidas del presupuesto; los importes calculados no autorizan pagos. */
export interface BudgetLine {
  providerName?: string;
  id: string;
  description: string;
  categoryId: string;
  supplierId: string;
  chargeType: ChargeType | 'crew';
  basis: 'total' | 'paying' | 'free' | 'participants' | 'units';
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
  rate: number;
  rateSource: string;
  rateDate: string;
  buffer: number;
  days: number;
  nights: number;
  minimum: number;
  capacity: number;
  included: boolean;
  state: 'estimated' | 'quoted' | 'committed' | 'confirmed';
  note: string;
  tiers: { from: number; unitPrice: number }[];
  allocations: { supplierId: string; amount: number }[];
}
/** Snapshot independiente del contrato y las operaciones reales. */
export interface BalanceBudget {
  name: string;
  totalPassengers: number;
  freePassengers: number;
  days: number;
  nights: number;
  pricePerPayer: number;
  discount: number;
  contingency: number;
  targetMode: 'amount' | 'margin';
  target: number;
  source: { kind: 'manual' | 'contract' | 'quotation'; id: string; version: string; date: string };
  taxes: TaxSettings & { source: string; costBasis: 'net' };
  categories: { id: string; name: string }[];
  lines: BudgetLine[];
  flows: { date: string; description: string; amount: number }[];
  forecastComplete: boolean;
}
/** Actor y motivo provienen de la operación persistida en servidor. */
export interface BalanceAudit {
  actor: string;
  at: string;
  reason: string;
  action: string;
}
export interface BalanceState {
  version: number;
  current: BalanceBudget | null;
  baseline: BalanceBudget | null;
  scenarios: Record<string, BalanceBudget>;
  audit: BalanceAudit;
}
/** TotalPassengers contractual significa pagantes, no total de viajeros. */
export interface BalanceTrip {
  id: string;
  version: number;
  status: string;
  institutionName: string;
  destination: string;
  period: string;
  content: {
    institution: { course: string };
    trip: { departureDate: string; days: number; nights: number };
    payments: {
      totalPassengers: number;
      freePassengers: number;
      totalGroup: number;
      pricePerPerson: number;
    };
  };
  programReference: { id: string; updatedAt: string; content: FavoriteContent } | null;
  rosterCount: number;
  quantityConsistent: boolean;
}
/** Posición actual y movimientos fechados se conservan separados. */
export interface BalanceFinance {
  contractedSale?: number;
  receiptHistory?: { date: string; amount: number }[];
  historyComplete?: boolean;
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
  overdue: number;
  aging: number[];
  suppliers: SupplierCommitment[];
  cashDays: { date: string; inflows: number; outflows: number }[];
  opening: number;
  closing: number;
  inflows: number;
  outflows: number;
  actualFees: number;
  scheduled: { date: string; original: number; pending: number }[];
  activePassengers: number;
  freePassengers: number;
}
export interface BalanceRow {
  financeStatus?: 'AVAILABLE' | 'NOT_ENABLED' | 'UNAVAILABLE';
  trip: BalanceTrip;
  state: BalanceState;
  finance: BalanceFinance | null;
  issue: string;
}
export interface BalancePageResponse {
  items: BalanceRow[];
  nextCursor?: string;
  from: string;
  to: string;
  asOf: string;
  updatedAt: string;
}
export interface BalanceDetail {
  row: BalanceRow;
  revisions: BalanceState[];
  from: string;
  to: string;
  asOf: string;
  updatedAt: string;
}
export type BalancePage = BalancePageResponse;
export interface BalanceCommand {
  commandId: string;
  version: number;
  action: 'SAVE' | 'SCENARIO' | 'APPROVE' | 'PROMOTE';
  scenarioId: string;
  reason: string;
  budget: BalanceBudget | null;
}
/** Resultado explicable en CLP; null distingue datos insuficientes de cero. */
export interface BalanceCalculation {
  cost: number | null;
  netSale: number;
  grossSale: number;
  result: number | null;
  margin: number | null;
  markup: number | null;
  costPerTraveler: number | null;
  costPerPayer: number | null;
  requiredPrice: number | null;
  paying: number;
  rows: {
    id: string;
    categoryId: string;
    currency: CurrencyCode;
    amount: number;
    confirmed: boolean;
  }[];
  errors: string[];
}
