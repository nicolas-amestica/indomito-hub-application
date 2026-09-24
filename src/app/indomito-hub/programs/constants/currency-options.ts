import type { CurrencyCode } from '../interfaces/program.interface';

/** Opción de moneda reutilizada por las filas de tripulación y servicios. */
export interface CurrencyOption {
  value: CurrencyCode;
  label: string;
}

/** Monedas admitidas por el contrato del programa, en el orden de uso habitual. */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: 'CLP', label: 'Peso chileno (CLP)' },
  { value: 'USD', label: 'Dólar estadounidense (USD)' },
  { value: 'BRL', label: 'Real brasileño (BRL)' },
];
