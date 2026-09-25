import type { ContractPassengerSex } from '../interfaces/contract.interface';

export const CONTRACT_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
].map((name, index) => ({ label: name, value: String(index + 1).padStart(2, '0') }));

export const CONTRACT_SEX_OPTIONS: Array<{ label: string; value: ContractPassengerSex }> = [
  { label: 'Femenino', value: 'FEMALE' },
  { label: 'Masculino', value: 'MALE' },
  { label: 'Otro', value: 'OTHER' },
  { label: 'Prefiere no indicar', value: 'NOT_SPECIFIED' },
];
