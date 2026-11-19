import { perPassengerPrice } from '../../programs/calculation/per-passenger-split';
import { baseAmount } from '../../programs/calculation/charge-type';
import { calculateProgram } from '../../programs/calculation/calculation-engine';
import { round } from '../../programs/calculation/rounding';
import type {
  BalanceBudget,
  BalanceCalculation,
  BudgetLine,
} from '../interfaces/balance.interface';

/** Reutiliza multiplicadores del motor con bases y duraciones explícitas por partida. */
export function calculateLine(line: BudgetLine, budget: BalanceBudget): number {
  const paying = budget.totalPassengers - budget.freePassengers;
  const count =
    line.basis === 'total'
      ? budget.totalPassengers
      : line.basis === 'paying'
        ? paying
        : line.basis === 'free'
          ? budget.freePassengers
          : line.quantity;
  const effectiveCount = Math.max(count, line.minimum);
  if (line.capacity > 0 && count > line.capacity)
    throw new Error(
      `«${line.description}» supera la capacidad de ${line.capacity} personas o unidades.`,
    );
  const tier = [...line.tiers]
    .reverse()
    .find((candidate) => budget.totalPassengers >= candidate.from);
  const unitPrice = tier?.unitPrice ?? line.unitPrice;
  const schedule = {
    totalPassengers: effectiveCount,
    freePassengers: 0,
    totalDays: line.days,
    totalNights: line.nights,
  };
  const item =
    line.chargeType === 'crew'
      ? { name: line.description, dailyPrice: unitPrice, currency: line.currency, documentId: '' }
      : { name: line.description, unitPrice, currency: line.currency, chargeType: line.chargeType };
  // fixed y crew no usan pasajeros; las unidades explícitas multiplican su cantidad.
  const units =
    line.basis === 'units' &&
    (line.chargeType === 'fixed' || line.chargeType === 'crew' || line.chargeType === 'per_day')
      ? effectiveCount
      : 1;
  return baseAmount(item, schedule) * units * (line.rate + line.buffer);
}

/** Calcula escenarios en base neta sin sumar retenciones al honorario bruto. */
export function calculateBalance(budget: BalanceBudget): BalanceCalculation {
  const paying = budget.totalPassengers - budget.freePassengers;
  const errors: string[] = [];
  if (
    !Number.isInteger(paying) ||
    paying < 1 ||
    budget.freePassengers < 0 ||
    budget.totalPassengers > 1000
  )
    errors.push('Debe existir al menos una persona pagante y las cantidades deben ser enteras.');
  if (!budget.taxes.source || budget.taxes.costBasis !== 'net')
    errors.push('Falta identificar los impuestos y la base neta de los costos.');
  if (
    budget.discount < 0 ||
    budget.discount > 100 ||
    budget.contingency < 0 ||
    budget.contingency > 100 ||
    budget.taxes.vatRate < 0 ||
    budget.taxes.vatRate > 100
  )
    errors.push('Revisa descuentos, contingencia e impuestos.');
  if (
    ![
      budget.pricePerPayer,
      budget.discount,
      budget.contingency,
      budget.target,
      budget.taxes.vatRate,
      budget.taxes.crewWithholdingRate,
    ].every(Number.isFinite) ||
    budget.pricePerPayer < 0 ||
    budget.target < 0 ||
    (budget.targetMode === 'margin' && budget.target >= 100)
  )
    errors.push('Revisa el precio, los impuestos y el objetivo.');
  if (errors.length)
    return {
      cost: null,
      netSale: 0,
      grossSale: 0,
      result: null,
      margin: null,
      markup: null,
      costPerTraveler: null,
      costPerPayer: null,
      requiredPrice: null,
      paying,
      rows: [],
      errors,
    };
  const rows: BalanceCalculation['rows'] = [];
  for (const line of budget.lines.filter((item) => item.included)) {
    if (
      ![line.unitPrice, line.rate, line.buffer, line.quantity, line.days, line.nights].every(
        Number.isFinite,
      ) ||
      line.unitPrice < 0 ||
      line.quantity < 0 ||
      line.days < 0 ||
      line.nights < 0 ||
      line.buffer < 0 ||
      line.rate <= 0 ||
      !line.rateSource ||
      !/^\d{4}-\d{2}-\d{2}$/.test(line.rateDate)
    ) {
      errors.push(`Completa el precio y la procedencia de la moneda de «${line.description}».`);
      continue;
    }
    try {
      rows.push({
        id: line.id,
        categoryId: line.categoryId,
        currency: line.currency,
        amount: calculateLine(line, budget),
        confirmed: line.state === 'confirmed',
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Partida inválida.');
    }
  }
  const grossSale = round(paying * budget.pricePerPayer * (1 - budget.discount / 100));
  const netSale = round(grossSale / (1 + budget.taxes.vatRate / 100));
  const program = calculateProgram(
    {
      schedule: {
        totalDays: budget.days,
        totalNights: budget.nights,
        totalPassengers: budget.totalPassengers,
        freePassengers: budget.freePassengers,
      },
      pricing: { utilityRate: 0, rechargeRate: 0, usdIncreaseCLP: 0, brlIncreaseCLP: 0 },
      rates: { CLP: 1, USD: 1, BRL: 1 },
      crews: [],
      services: rows.map((row) => ({
        id: row.id,
        name: row.id,
        chargeType: 'fixed',
        unitPrice: row.amount,
        currency: 'CLP',
      })),
    },
    budget.taxes,
  );
  if (program.totals.netCLP > 1e12 || !Number.isSafeInteger(program.totals.netCLP))
    errors.push('El costo supera el límite permitido para el presupuesto.');
  const cost =
    rows.length > 0 && errors.length === 0
      ? round(program.totals.netCLP * (1 + budget.contingency / 100))
      : null;
  const result = cost === null ? null : netSale - cost;
  const targetNet =
    cost === null
      ? null
      : budget.targetMode === 'margin'
        ? budget.target >= 100
          ? null
          : cost / (1 - budget.target / 100)
        : cost + budget.target;
  const requiredPrice =
    targetNet === null || paying < 1 || budget.discount >= 100
      ? null
      : Math.ceil(
          (targetNet * (1 + budget.taxes.vatRate / 100)) / paying / (1 - budget.discount / 100),
        );
  return {
    cost,
    netSale,
    grossSale,
    result,
    paying,
    requiredPrice,
    margin: result === null || netSale <= 0 ? null : (result / netSale) * 100,
    markup: result === null || !cost ? null : (result / cost) * 100,
    costPerTraveler: cost === null ? null : perPassengerPrice(cost, budget.totalPassengers),
    costPerPayer: cost === null || paying < 1 ? null : perPassengerPrice(cost, paying),
    rows,
    errors,
  };
}

/** Evalúa cantidades discretas sin asumir costos lineales ni alterar el precio fijo. */
export function balanceCurve(
  budget: BalanceBudget,
  min: number,
  max: number,
): { paying: number; result: number | null; requiredPrice: number | null }[] {
  return Array.from({ length: Math.max(0, Math.min(1000, max - min + 1)) }, (_, index) => {
    const paying = min + index;
    const result = calculateBalance({ ...budget, totalPassengers: paying + budget.freePassengers });
    return { paying, result: result.result, requiredPrice: result.requiredPrice };
  });
}
