import type { CalculationInput } from './calculation.types';
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
  it('usa los desplazamientos por defecto y conserva la proporción de liberados', () => {
    expect(deriveScenarios(INPUT.schedule)).toEqual([
      { totalPassengers: 20, freePassengers: 1, payingPassengers: 19 },
      { totalPassengers: 25, freePassengers: 2, payingPassengers: 23 },
      { totalPassengers: 30, freePassengers: 2, payingPassengers: 28 },
      { totalPassengers: 35, freePassengers: 2, payingPassengers: 33 },
    ]);
  });

  it('deduplica después de acotar al mínimo de un pasajero', () => {
    expect(
      deriveScenarios(
        { ...INPUT.schedule, totalPassengers: 3, freePassengers: 0 },
        [-10, -5, 0, 5],
      ),
    ).toEqual([
      { totalPassengers: 1, freePassengers: 0, payingPassengers: 1 },
      { totalPassengers: 3, freePassengers: 0, payingPassengers: 3 },
      { totalPassengers: 8, freePassengers: 0, payingPassengers: 8 },
    ]);
  });

  it('recalcula los servicios dependientes con la cantidad del escenario', () => {
    const result = calculateScenario(INPUT, {
      totalPassengers: 20,
      freePassengers: 1,
      payingPassengers: 19,
    });

    expect(result.rows[0].baseAmount).toBe(20 * 6 * 50);
    expect(result.rows[0].amountCLP).toBe(20 * 6 * 50 * 1_050);
  });
});
