import type { BalanceRow } from '../interfaces/balance.interface';
import { contractualSale, operatingBalance } from './operating-balance';
import { calculateBalance } from './calculate-balance';
import { supplierMetrics } from './financial-metrics';

/** Una fila mantiene valores numéricos para ordenar y exportar sin parsear etiquetas. */
export function balanceTableRow(row: BalanceRow) {
  const budget = row.state.current;
  const calc = operatingBalance(row);
  const base = row.state.baseline ? calculateBalance(row.state.baseline) : null;
  const suppliers = row.finance ? supplierMetrics(row.finance) : null;
  return {
    id: row.trip.id,
    institution: row.trip.institutionName,
    course: row.trip.content.institution.course,
    destination: row.trip.destination,
    departure: row.trip.content.trip.departureDate?.slice(0, 10) || 'Sin fecha',
    total:
      budget?.totalPassengers ??
      row.trip.content.payments.totalPassengers + row.trip.content.payments.freePassengers,
    paying: budget
      ? budget.totalPassengers - budget.freePassengers
      : row.trip.content.payments.totalPassengers,
    free: budget?.freePassengers ?? row.trip.content.payments.freePassengers,
    sale: contractualSale(row),
    collected: row.finance?.position.appliedReceipts ?? null,
    pending: row.finance?.position.receivable ?? null,
    deposit: row.finance?.position.depositReceivable ?? null,
    overdue: row.finance?.overdue ?? null,
    baseline: base?.cost ?? null,
    cost: calc?.cost ?? null,
    committed: suppliers?.committed ?? null,
    paid: suppliers?.paid ?? null,
    supplierPending: suppliers?.pending ?? null,
    result: calc?.result ?? null,
    margin: calc?.margin ?? null,
    variance:
      calc?.cost === null || !calc || base?.cost === null || !base ? null : calc.cost - base.cost,
    coverage: row.issue
      ? 'Datos operativos incompletos'
      : !budget || calc?.cost === null
        ? 'Falta presupuesto'
        : 'Presupuesto y posición disponibles',
    version: row.state.version,
  };
}
