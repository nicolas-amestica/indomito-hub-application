import { describe, expect, it } from 'vitest';
import { createBudget, createLine, importContractBudget } from './create-budget';
import { balanceCurve, calculateBalance, calculateLine } from './calculate-balance';
import { fundingProjection, supplierMetrics, unbudgetedCommitments } from './financial-metrics';
import type { BalanceFinance, BalanceTrip } from '../interfaces/balance.interface';
import type { FavoriteContent } from '../../programs/interfaces/favorite.interface';
import { balanceId } from './balance-id';

const taxes = { vatRate: 19, crewWithholdingRate: 15.25 };
const today = '2026-11-18';
function trip(): BalanceTrip {
  return {
    id: '01J00000000000000000000000',
    version: 2,
    institutionName: 'Institución de prueba',
    destination: 'Destino de prueba',
    period: '2026',
    status: 'APPROVED',
    rosterCount: 32,
    quantityConsistent: true,
    programReference: null,
    content: {
      institution: { course: 'Curso de prueba' },
      trip: { departureDate: '2027-01-15', days: 6, nights: 4 },
      payments: {
        totalPassengers: 30,
        freePassengers: 2,
        totalGroup: 3570000,
        pricePerPerson: 119000,
      },
    },
  };
}
function budget() {
  const b = createBudget(trip(), taxes, today);
  b.lines = [
    {
      ...createLine(b, today),
      description: 'Hotel',
      chargeType: 'per_passenger_night',
      nights: 2,
      unitPrice: 1000,
    },
  ];
  return b;
}
function finance(): BalanceFinance {
  return {
    position: {
      receivable: 0,
      depositReceivable: 0,
      installmentReceivable: 0,
      appliedReceipts: 0,
      unappliedReceipts: 0,
      discounts: 0,
      cancelled: 0,
      refundPayable: 0,
      refunded: 0,
    },
    overdue: 0,
    aging: [0, 0, 0, 0],
    suppliers: [],
    cashDays: [],
    opening: 0,
    closing: 0,
    inflows: 0,
    outflows: 0,
    actualFees: 0,
    scheduled: [],
    activePassengers: 32,
    freePassengers: 2,
  };
}

describe('Presupuesto y simulación operativa', () => {
  it('convierte 30 pagantes y 2 liberados en 32 viajeros sin alterar contrato', () => {
    const t = trip();
    const b = createBudget(t, taxes, today);
    expect(b.totalPassengers).toBe(32);
    expect(b.totalPassengers - b.freePassengers).toBe(30);
    expect(t.content.payments.totalPassengers).toBe(30);
  });
  it('los liberados generan costo salvo excepción explícita del proveedor', () => {
    const b = budget();
    expect(calculateBalance(b).cost).toBe(64000);
    b.lines[0].basis = 'paying';
    expect(calculateBalance(b).cost).toBe(60000);
  });
  it('cada servicio usa sus noches, no todas las noches del viaje', () => {
    const b = budget();
    b.nights = 20;
    expect(calculateBalance(b).cost).toBe(64000);
  });
  it('admite participantes efectivos y unidades contratadas', () => {
    const b = budget();
    b.lines[0].basis = 'participants';
    b.lines[0].quantity = 12;
    expect(calculateBalance(b).cost).toBe(24000);
    b.lines[0] = { ...b.lines[0], basis: 'units', chargeType: 'fixed', quantity: 3 };
    expect(calculateBalance(b).cost).toBe(3000);
  });
  it('usa moneda, resguardo y redondeo compartidos', () => {
    const b = budget();
    b.lines[0] = {
      ...b.lines[0],
      chargeType: 'fixed',
      unitPrice: 10.12,
      currency: 'USD',
      rate: 900,
      buffer: 50,
    };
    expect(calculateBalance(b).cost).toBe(9614);
  });
  it('mantiene precio fijo al reducir pagantes', () => {
    const b = budget();
    const original = calculateBalance(b);
    const changed = calculateBalance({ ...b, totalPassengers: 22 });
    expect(changed.grossSale).toBe(20 * b.pricePerPayer);
    expect(changed.netSale).toBeLessThan(original.netSale);
    expect(b.pricePerPayer).toBe(119000);
  });
  it('distingue margen sobre venta y recargo sobre costo', () => {
    const b = budget();
    b.lines[0] = { ...b.lines[0], chargeType: 'fixed', unitPrice: 1000000 };
    b.pricePerPayer = 59500;
    b.totalPassengers = 32;
    const c = calculateBalance(b);
    expect(c.netSale).toBe(1500000);
    expect(c.margin).toBeCloseTo(33.333333);
    expect(c.markup).toBe(50);
  });
  it('resuelve precio para objetivo de margen con impuestos y descuento', () => {
    const b = budget();
    b.targetMode = 'margin';
    b.target = 20;
    b.discount = 10;
    const c = calculateBalance(b);
    expect(c.requiredPrice).toBe(Math.ceil(((64000 / 0.8) * 1.19) / 30 / 0.9));
  });
  it('no suma retención de honorarios como otro costo', () => {
    const b = budget();
    b.lines[0] = { ...b.lines[0], chargeType: 'crew', days: 3, unitPrice: 100000 };
    expect(calculateBalance(b).cost).toBe(300000);
  });
  it('rechaza cero pagantes antes de presentar un resultado válido', () => {
    const b = budget();
    b.freePassengers = b.totalPassengers;
    const c = calculateBalance(b);
    expect(c.cost).toBeNull();
    expect(c.result).toBeNull();
    expect(c.requiredPrice).toBeNull();
    expect(c.errors.length).toBeGreaterThan(0);
  });
  it('no convierte un presupuesto ausente en costo cero', () => {
    const b = budget();
    b.lines = [];
    expect(calculateBalance(b).cost).toBeNull();
  });
  it('respeta costos escalonados y capacidades al enumerar equilibrio', () => {
    const b = budget();
    b.freePassengers = 2;
    b.lines[0] = {
      ...b.lines[0],
      chargeType: 'fixed',
      capacity: 40,
      unitPrice: 1000000,
      tiers: [{ from: 31, unitPrice: 2000000 }],
    };
    expect(calculateLine(b.lines[0], b)).toBe(2000000);
    const curve = balanceCurve(b, 1, 50);
    expect(curve.find((point) => point.paying === 39)?.result).toBeNull();
    expect(curve.find((point) => point.paying === 28)?.result).not.toBeNull();
  });
  it('distingue objetivo sin solución por descuento total', () => {
    const b = budget();
    b.discount = 100;
    expect(calculateBalance(b).requiredPrice).toBeNull();
    expect(calculateBalance(b).result).toBe(-64000);
  });
  it('evita totales numéricos no finitos', () => {
    const b = budget();
    b.lines[0].rate = Number.NaN;
    expect(calculateBalance(b).cost).toBeNull();
  });
  it('genera ULID compatible con persistencia', () => {
    expect(balanceId()).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });
});
describe('Importación histórica', () => {
  it('no usa tasas actuales si faltan snapshots históricos', () => {
    expect(() => importContractBudget(trip(), taxes, today)).toThrow(/históricos/);
  });
  it('bloquea importación si no coinciden las cantidades de nómina', () => {
    const t = trip();
    t.quantityConsistent = false;
    expect(() => importContractBudget(t, taxes, today)).toThrow(/nómina/);
  });
  it('importa sin duplicar y respeta tasas e impuestos originales', () => {
    const t = trip();
    const b = budget();
    t.programReference = {
      id: t.id,
      updatedAt: '2026-01-01',
      content: {
        schedule: { totalDays: 6, totalNights: 4, totalPassengers: 32, freePassengers: 2 },
        pricing: {
          usdIncreaseCLP: 20,
          brlIncreaseCLP: 0,
          utilityRate: 30,
          rechargeRate: 0,
          exchange: {
            date: '2026-01-01',
            usdToClp: 800,
            brlToClp: 150,
            source: 'banco-central',
            isFallback: false,
          },
        },
        totals: { vatRate: 10, crewWithholdingRate: 13 },
        services: [{ name: 'Servicio USD', currency: 'USD', chargeType: 'fixed', unitPrice: 100 }],
        crews: [],
      } as unknown as FavoriteContent,
    };
    const first = importContractBudget(t, taxes, today);
    const second = importContractBudget(t, { vatRate: 22, crewWithholdingRate: 20 }, today);
    expect(first.lines).toHaveLength(1);
    expect(second.lines).toHaveLength(1);
    expect(first.lines[0].rate).toBe(800);
    expect(first.lines[0].buffer).toBe(20);
    expect(second.taxes.vatRate).toBe(10);
    expect(calculateBalance(first).cost).toBe(82000);
    expect(b.lines).toHaveLength(1);
  });
});
describe('Finanzas sin doble conteo', () => {
  it('compromiso y pago no se suman y recuperación acordada no es efectivo', () => {
    const f = finance();
    f.suppliers = [
      {
        id: 's',
        tripId: 't',
        name: 'Proveedor',
        service: 'Hotel',
        version: 1,
        committed: 1000,
        paid: 800,
        refundAgreed: 300,
        refundReceived: 100,
      },
    ];
    expect(supplierMetrics(f)).toEqual({ committed: 1000, paid: 700, pending: 300, recovery: 200 });
  });
  it('relaciones parciales identifican costo aún no cubierto', () => {
    const b = budget();
    const f = finance();
    f.suppliers = [
      {
        id: 's',
        tripId: 't',
        name: 'Proveedor',
        service: 'Hotel',
        version: 1,
        committed: 1000,
        paid: 0,
        refundAgreed: 0,
        refundReceived: 0,
      },
    ];
    b.lines[0].allocations = [{ supplierId: 's', amount: 600 }];
    expect(unbudgetedCommitments(b, f)).toBe(400);
  });
  it('máximo déficit usa fechas y distingue cobertura parcial', () => {
    const b = budget();
    b.flows = [
      { date: '2026-11-20', description: 'Pago previsto', amount: -1000 },
      { date: '2026-11-22', description: 'Cobro previsto', amount: 1200 },
    ];
    const result = fundingProjection(b, 200, today);
    expect(result.deficit).toBe(800);
    expect(result.complete).toBe(false);
    b.forecastComplete = true;
    expect(fundingProjection(b, 200, today).complete).toBe(true);
  });
  it('sin saldo respaldado no proyecta un cero artificial', () => {
    expect(fundingProjection(budget(), null, today).deficit).toBeNull();
  });
});
