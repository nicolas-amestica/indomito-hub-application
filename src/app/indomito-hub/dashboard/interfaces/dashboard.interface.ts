import type { ContractSummary } from '../../contracts/interfaces/contract.interface';
import type {
  ConsolidatedCashView,
  GlobalCollectionAlertView,
} from '../../collections/interfaces/collection-treasury.interface';

export interface DashboardView {
  contracts: ContractSummary[];
  cash: ConsolidatedCashView;
  alerts: GlobalCollectionAlertView;
}
