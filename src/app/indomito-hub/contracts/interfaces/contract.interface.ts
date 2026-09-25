export type ContractStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export interface ContractPerson {
  name: string;
  dni: string;
  course: string;
}
export type ContractPassengerSex = 'FEMALE' | 'MALE' | 'OTHER' | 'NOT_SPECIFIED';
export interface ContractPassenger {
  names: string;
  lastNames: string;
  dni: string;
  birthDate: string;
  nationality: string;
  sex: ContractPassengerSex;
}
export interface ContractProgramReference {
  id: string;
  name: string;
  updatedAt: string;
  content: Record<string, unknown>;
}
export interface ContractCountryOption {
  code: string;
  name: string;
}
export interface ContractBankAccountOption {
  id: string;
  label: string;
  accountNumber: string;
  accountHolder: string;
  holderDNI: string;
  bank: string;
  accountType: string;
  email: string;
}
export interface ContractFormConfiguration {
  companyRepresentatives: ContractPerson[];
  bankAccounts: ContractBankAccountOption[];
  defaults: { daysBeforePayment: number; specialProgramDeposit: number };
  countries: ContractCountryOption[];
}
export interface ContractContent {
  representatives: ContractPerson[];
  institution: { name: string; address: string; course: string };
  clientRepresentatives: ContractPerson[];
  trip: {
    city: string;
    contractDate: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    days: number;
    nights: number;
    departurePoint: string;
  };
  plan: { name: string; servicesIncluded: { description: string }[] };
  payments: {
    totalPassengers: number;
    freePassengers: number;
    pricePerPerson: number;
    totalGroup: number;
    downPayment: number;
    groupBalance: number;
    daysBeforePayment: number;
    maxExchangeRate: number;
    installments: {
      quantity: number;
      groupInstallmentValue: number;
      individualInstallmentValue: number;
      startMonth: string;
    };
    conditions: {
      depositPercentageWithFlight: number;
      depositPercentageWithoutFlight: number;
      specialProgramDeposit: number;
      daysBeforeFlightBalance: number;
      daysBeforeTerrestrialBalance: number;
      cancellationPenaltyPercentage: number;
      cancellationNoticeDays: number;
      complaintDeadlineDays: number;
    };
    bankAccount: {
      accountNumber: string;
      accountHolder: string;
      holderDNI: string;
      bank: string;
      email: string;
    };
  };
  passengers: ContractPassenger[];
}
export interface Contract {
  id: string;
  programId?: string;
  programReference?: ContractProgramReference;
  period: string;
  status: ContractStatus;
  content: ContractContent;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export interface ContractCreateRequest {
  programId?: string;
  programReference?: ContractProgramReference;
  period?: string;
  content: ContractContent;
}
export interface ContractUpdateRequest {
  programId?: string;
  programReference?: ContractProgramReference;
  period: string;
  status: ContractStatus;
  content: ContractContent;
  version: number;
}
