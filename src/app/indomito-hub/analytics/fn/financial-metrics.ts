import type { BalanceBudget, BalanceFinance } from '../interfaces/balance.interface';

/** Los compromisos ya incluyen sus pagos; las recuperaciones se distinguen de acuerdos. */
export function supplierMetrics(finance: BalanceFinance) {
  return finance.suppliers.reduce(
    (total, supplier) => ({
      committed: total.committed + supplier.committed,
      paid: total.paid + supplier.paid - supplier.refundReceived,
      pending:
        total.pending + Math.max(0, supplier.committed - supplier.paid + supplier.refundReceived),
      recovery: total.recovery + supplier.refundAgreed - supplier.refundReceived,
    }),
    { committed: 0, paid: 0, pending: 0, recovery: 0 },
  );
}

/** Muestra exposición sin sumar nuevamente compromisos ya asociados a partidas. */
export function unbudgetedCommitments(budget: BalanceBudget, finance: BalanceFinance): number {
  return finance.suppliers.reduce((sum, supplier) => {
    const linked = budget.lines
      .filter((line) => line.included)
      .flatMap((line) => line.allocations)
      .filter((allocation) => allocation.supplierId === supplier.id)
      .reduce((amount, allocation) => amount + allocation.amount, 0);
    return sum + Math.max(0, supplier.committed - linked);
  }, 0);
}

/** El máximo déficit proyectado usa flujos fechados; una cobertura parcial nunca se etiqueta definitiva. */
export function fundingProjection(budget: BalanceBudget, opening: number | null, asOf: string) {
  if (opening === null)
    return { deficit: null, complete: false, rows: [] as { date: string; balance: number }[] };
  const dates = new Map<string, number>();
  for (const flow of budget.flows.filter((entry) => entry.date > asOf))
    dates.set(flow.date, (dates.get(flow.date) ?? 0) + flow.amount);
  let balance = opening;
  let minimum = balance;
  const rows = [...dates]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => {
      balance += amount;
      minimum = Math.min(minimum, balance);
      return { date, balance };
    });
  return {
    deficit: rows.length ? Math.max(0, -minimum) : null,
    complete: budget.forecastComplete && rows.length > 0,
    rows,
  };
}
