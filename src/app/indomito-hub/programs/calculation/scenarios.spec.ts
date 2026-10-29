import type { CalculationInput } from '../types/calculation.types';
import { calculateScenario, deriveScenarios } from './scenarios';

const INPUT: CalculationInput = {
  schedule: {
    totalDays: 7,
    totalNights: 6,
    totalPassengers: 30,
    freePassengers: 2,
  },
  pricing: {
    usdIncreaseCLP: 50,
    brlIncreaseCLP: 10,
    utilityRate: 20,
    rechargeRate: 5,
  },
  rates: { CLP: 1, USD: 1_050, BRL: 210 },
  crews: [],
  services: [
    {
      name: 'Hotel',
      chargeType: 'per_passenger_night',
      unitPrice: 50,
      currency: 'USD',
    },
  ],
};

describe('scenarios', () => {
  it('usa siempre las cantidades comerciales fijas', () => {
    expect(deriveScenarios()).toEqual([
      { totalPassengers: 20, freePassengers: 2, payingPassengers: 18 },
      { totalPassengers: 25, freePassengers: 2, payingPassengers: 23 },
      { totalPassengers: 30, freePassengers: 3, payingPassengers: 27 },
      { totalPassengers: 35, freePassengers: 3, payingPassengers: 32 },
      { totalPassengers: 40, freePassengers: 3, payingPassengers: 37 },
    ]);
  });

  it('recalcula los servicios dependientes con la cantidad del escenario', () => {
    const result = calculateScenario(INPUT, {
      totalPassengers: 20,
      freePassengers: 2,
      payingPassengers: 18,
    });

    expect(result.rows[0].baseAmount).toBe(20 * 6 * 50);
    expect(result.rows[0].amountCLP).toBe(20 * 6 * 50 * 1_050);
  });
});
