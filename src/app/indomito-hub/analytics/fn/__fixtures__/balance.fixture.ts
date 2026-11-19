import type { BalanceDetail, BalanceTrip } from '../../interfaces/balance.interface';
import { createBudget, createLine } from '../create-budget';
/** Datos ficticios usados únicamente por pruebas automatizadas. */
export function balanceDetailFixture(id = '01J00000000000000000000000'): BalanceDetail {
  const trip: BalanceTrip = {
    id,
    version: 1,
    status: 'APPROVED',
    institutionName: 'Institución ficticia',
    destination: 'Destino ficticio',
    period: '2026',
    rosterCount: 32,
    quantityConsistent: true,
    programReference: null,
    content: {
      institution: { course: 'Prueba' },
      trip: { departureDate: '2027-01-01', days: 5, nights: 3 },
      payments: {
        totalPassengers: 30,
        freePassengers: 2,
        totalGroup: 3570000,
        pricePerPerson: 119000,
      },
    },
  };
  const budget = createBudget(trip, { vatRate: 19, crewWithholdingRate: 15.25 }, '2026-11-18');
  budget.lines = [
    { ...createLine(budget, '2026-11-18'), description: 'Costo ficticio', unitPrice: 100000 },
  ];
  return {
    row: {
      trip,
      state: {
        version: 1,
        current: budget,
        baseline: null,
        scenarios: {},
        audit: { actor: 'test', at: '2026-11-18T12:00:00Z', reason: 'Prueba', action: 'SAVE' },
      },
      finance: null,
      issue: 'Cobranza no habilitada',
    },
    revisions: [],
    from: '2026-01-01',
    to: '2026-11-18',
    asOf: '2026-11-18',
    updatedAt: '2026-11-18T12:00:00Z',
  };
}
