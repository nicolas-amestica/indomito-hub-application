import type { BalanceRow } from '../interfaces/balance.interface';
import { calculateBalance } from './calculate-balance';
/** Venta contractual operativa, con fallback solo cuando todavía no existe cobranza. */
export function contractualSale(row: BalanceRow): number | null {
  if (row.finance) return row.finance.contractedSale ?? null;
  return row.financeStatus === 'NOT_ENABLED' ? row.trip.content.payments.totalGroup : null;
}
/** Mantiene la venta vigente fija al comparar costos actualizados; las simulaciones usan su propia venta. */
export function operatingBalance(row: BalanceRow) {
  if (!row.state.current) return null;
  const calculation = calculateBalance(row.state.current);
  const sale = contractualSale(row);
  const netSale =
    sale === null ? null : Math.round(sale / (1 + row.state.current.taxes.vatRate / 100));
  const result = netSale === null || calculation.cost === null ? null : netSale - calculation.cost;
  return {
    ...calculation,
    netSale,
    grossSale: sale,
    result,
    margin: result === null || !netSale ? null : (result / netSale) * 100,
    markup: result === null || !calculation.cost ? null : (result / calculation.cost) * 100,
  };
}
