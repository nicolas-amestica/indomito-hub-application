import type { TaxSettings } from '../../../core/configuration/app-configuration.service';
import type { FavoriteContent } from '../../programs/interfaces/favorite.interface';
import type { BalanceTrip, BalanceBudget, BudgetLine } from '../interfaces/balance.interface';
import { INITIAL_CATEGORIES } from '../constants/balance-options';
import { balanceId } from './balance-id';

/** Crea un borrador manual; las tasas extranjeras nunca se completan automáticamente. */
export function createBudget(trip: BalanceTrip, taxes: TaxSettings, today: string): BalanceBudget {
  const p = trip.content.payments;
  return {
    name: `Presupuesto ${trip.institutionName}`,
    totalPassengers: p.totalPassengers + p.freePassengers,
    freePassengers: p.freePassengers,
    days: trip.content.trip.days || 1,
    nights: trip.content.trip.nights || 0,
    pricePerPayer: p.pricePerPerson,
    discount: 0,
    contingency: 0,
    targetMode: 'amount',
    target: 0,
    source: { kind: 'manual', id: trip.id, version: String(trip.version), date: today },
    taxes: { ...taxes, source: `Configuración consultada el ${today}`, costBasis: 'net' },
    categories: INITIAL_CATEGORIES.map((name) => ({ id: balanceId(), name })),
    lines: [],
    flows: [],
    forecastComplete: false,
  };
}

/** Una partida nueva comienza en CLP y exige que el operador confirme su contenido. */
export function createLine(budget: BalanceBudget, today: string): BudgetLine {
  return {
    id: balanceId(),
    description: 'Nuevo costo',
    categoryId: budget.categories[0].id,
    supplierId: '',
    chargeType: 'fixed',
    basis: 'total',
    quantity: 1,
    unitPrice: 0,
    currency: 'CLP',
    rate: 1,
    rateSource: 'CLP sin conversión',
    rateDate: today,
    buffer: 0,
    days: budget.days,
    nights: budget.nights,
    minimum: 0,
    capacity: 0,
    included: true,
    state: 'estimated',
    note: '',
    tiers: [],
    allocations: [],
  };
}

/** Importa únicamente el snapshot contractual; no usa tasas vigentes para reconstruir históricos. */
export function importContractBudget(
  trip: BalanceTrip,
  taxes: TaxSettings,
  today: string,
): BalanceBudget {
  if (!trip.quantityConsistent)
    throw new Error(
      'Las cantidades del contrato no coinciden con su nómina. Revisa el contrato antes de importar.',
    );
  const content = trip.programReference?.content as Partial<FavoriteContent> | undefined;
  if (
    !content?.pricing?.exchange ||
    !content.totals ||
    !content.schedule ||
    !Array.isArray(content.services) ||
    !Array.isArray(content.crews)
  )
    throw new Error(
      'El contrato no conserva un presupuesto con tasas e impuestos históricos completos. Puedes crear uno manual e indicar la procedencia.',
    );
  const exchange = content.pricing.exchange;
  if (
    !Number.isFinite(exchange.usdToClp) ||
    !Number.isFinite(exchange.brlToClp) ||
    !Number.isFinite(content.totals.vatRate) ||
    !Number.isFinite(content.totals.crewWithholdingRate)
  )
    throw new Error('Faltan tasas históricas válidas en la cotización del contrato.');
  const budget = createBudget(trip, taxes, today);
  budget.source = {
    kind: 'contract',
    id: trip.id,
    version: String(trip.version),
    date: trip.programReference?.updatedAt ?? today,
  };
  budget.taxes = {
    vatRate: content.totals.vatRate,
    crewWithholdingRate: content.totals.crewWithholdingRate,
    source: `Snapshot contractual ${trip.id} v${trip.version}`,
    costBasis: 'net',
  };
  budget.lines = [
    ...content.services.map((service) => ({
      ...createLine(budget, today),
      description: service.name,
      chargeType: service.chargeType,
      unitPrice: service.unitPrice,
      currency: service.currency,
      categoryId: budget.categories[7].id,
    })),
    ...content.crews.map((crew) => ({
      ...createLine(budget, today),
      description: crew.name,
      chargeType: 'crew' as const,
      unitPrice: crew.dailyPrice,
      currency: crew.currency,
      categoryId: budget.categories[4].id,
    })),
  ].map((line) => ({
    ...line,
    rate:
      line.currency === 'CLP' ? 1 : line.currency === 'USD' ? exchange.usdToClp : exchange.brlToClp,
    buffer:
      line.currency === 'USD'
        ? (content.pricing?.usdIncreaseCLP ?? 0)
        : line.currency === 'BRL'
          ? (content.pricing?.brlIncreaseCLP ?? 0)
          : 0,
    rateSource: exchange.source,
    rateDate: exchange.date.slice(0, 10),
  }));
  return budget;
}
