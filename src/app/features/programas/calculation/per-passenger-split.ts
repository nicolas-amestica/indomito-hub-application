import type { SummaryRow } from '../interfaces/program.interface';
import { ceil } from './rounding';

/** Datos necesarios para repartir un monto entre pasajeros. */
export interface SplitContext {
  totalPassengers: number;
  freePassengers: number;
  payingPassengers: number;
  independentCLP: number;
  netRaw: number;
}

/** Partición proporcional de un monto según la composición del neto. */
export interface AmountSplit {
  independentShare: number;
  dependentShare: number;
}

/** Suma los montos CLP de las filas cuyo costo no depende de pasajeros. */
export function independentAmountCLP(rows: readonly SummaryRow[]): number {
  return rows
    .filter((row) => row.passengerIndependent)
    .map((row) => row.amountCLP)
    .sort((first, second) => first - second)
    .reduce((sum, value) => sum + value, 0);
}

/**
 * Divide un monto con la misma proporción independiente/dependiente de su neto.
 *
 * Cuando el neto es cero no existe una proporción definida; toda la cantidad se
 * deja en la porción dependiente y `perPassengerPrice` aplica la rama segura del
 * Requirement 8.8.
 */
export function splitAmount(amount: number, context: SplitContext): AmountSplit {
  if (context.netRaw === 0) {
    return { independentShare: 0, dependentShare: amount };
  }

  const independentRatio = Math.min(1, Math.max(0, context.independentCLP / context.netRaw));
  const independentShare = amount * independentRatio;

  return {
    independentShare,
    dependentShare: amount - independentShare,
  };
}

/** Calcula el precio individual de un monto con las reglas de pasajeros liberados. */
export function perPassengerPrice(amount: number, context: SplitContext): number {
  const payingPassengers = Math.max(1, context.payingPassengers);

  if (context.freePassengers === 0 || context.netRaw === 0) {
    return ceil(amount / payingPassengers);
  }

  const { independentShare, dependentShare } = splitAmount(amount, context);
  const totalPassengers = Math.max(1, context.totalPassengers);

  return ceil(independentShare / totalPassengers + dependentShare / payingPassengers);
}
