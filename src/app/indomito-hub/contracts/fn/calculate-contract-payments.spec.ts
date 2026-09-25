import { calculateContractPayments } from './calculate-contract-payments';

describe('calculateContractPayments', () => {
  it('calcula pagantes, total, saldo y cuotas desde las entradas editables', () => {
    expect(
      calculateContractPayments({
        passengerCount: 42,
        freePassengers: 2,
        pricePerPerson: 500_000,
        downPayment: 2_000_000,
        installmentQuantity: 6,
      }),
    ).toEqual({
      payingPassengers: 40,
      totalGroup: 20_000_000,
      groupBalance: 18_000_000,
      groupInstallmentValue: 3_000_000,
      individualInstallmentValue: 75_000,
    });
  });

  it('no produce saldos ni cuotas negativas', () => {
    expect(
      calculateContractPayments({
        passengerCount: 1,
        freePassengers: 4,
        pricePerPerson: 100_000,
        downPayment: 500_000,
        installmentQuantity: 0,
      }),
    ).toEqual({
      payingPassengers: 1,
      totalGroup: 100_000,
      groupBalance: 0,
      groupInstallmentValue: 0,
      individualInstallmentValue: 0,
    });
  });
});
