export interface ContractPaymentCalculationInput {
  passengerCount: number;
  freePassengers: number;
  pricePerPerson: number;
  downPayment: number;
  installmentQuantity: number;
}

export interface ContractPaymentCalculation {
  payingPassengers: number;
  totalGroup: number;
  groupBalance: number;
  groupInstallmentValue: number;
  individualInstallmentValue: number;
}

const nonNegativeInteger = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

/** Deriva todos los montos contractuales desde los únicos valores editables. */
export function calculateContractPayments(
  input: ContractPaymentCalculationInput,
): ContractPaymentCalculation {
  const passengerCount = nonNegativeInteger(input.passengerCount);
  const maxFreePassengers = Math.max(0, passengerCount - 1);
  const freePassengers = Math.min(nonNegativeInteger(input.freePassengers), maxFreePassengers);
  const payingPassengers = passengerCount - freePassengers;
  const pricePerPerson = nonNegativeInteger(input.pricePerPerson);
  const totalGroup = payingPassengers * pricePerPerson;
  const downPayment = nonNegativeInteger(input.downPayment);
  const groupBalance = Math.max(0, totalGroup - downPayment);
  const installmentQuantity = nonNegativeInteger(input.installmentQuantity);
  const groupInstallmentValue =
    installmentQuantity > 0 ? Math.ceil(groupBalance / installmentQuantity) : 0;
  const individualInstallmentValue =
    installmentQuantity > 0 && payingPassengers > 0
      ? Math.ceil(groupBalance / installmentQuantity / payingPassengers)
      : 0;

  return {
    payingPassengers,
    totalGroup,
    groupBalance,
    groupInstallmentValue,
    individualInstallmentValue,
  };
}
