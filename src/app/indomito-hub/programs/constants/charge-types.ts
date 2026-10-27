/**
 * Catálogo de tipos de cobro con sus etiquetas en español para el selector del
 * formulario y para `typeLabel` de `SummaryRow`. Las etiquetas son las del
 * Requirement 6.5, textuales.
 */
import type { ChargeType, PassengerChargeType } from '../interfaces/program.interface';

const PASSENGER_CHARGE_TYPES: readonly PassengerChargeType[] = [
  'per_passenger',
  'per_passenger_night',
  'per_passenger_day',
];

/** Indica si un tipo de cobro utiliza una cantidad de pasajeros. */
export function isPassengerChargeType(
  chargeType: ChargeType | null,
): chargeType is PassengerChargeType {
  return chargeType !== null && PASSENGER_CHARGE_TYPES.includes(chargeType as PassengerChargeType);
}

/** Etiqueta en español de cada tipo de cobro. Requirement 6.5. */
export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  fixed: 'Valor único',
  per_passenger: 'Valor una vez por pasajero',
  per_passenger_night: 'Valor por pasajero por noche',
  per_day: 'Valor por día',
  per_passenger_day: 'Valor por pasajero por día',
};

/**
 * Etiqueta de una fila de tripulación. Un tripulante no elige tipo de cobro
 * —su monto base es siempre `dailyPrice × totalDays`— pero la tabla de resumen
 * necesita una etiqueta propia para distinguirlo de los cinco tipos de cobro
 * (Requirement 9.5). Es el `typeLabel` de las filas cuyo `chargeType` es `null`.
 */
export const CREW_TYPE_LABEL = 'Tripulación';

/** Opción para un selector de PrimeNG: valor y etiqueta en español. */
export interface ChargeTypeOption {
  value: ChargeType;
  label: string;
}

/**
 * Los cinco tipos de cobro como lista de opciones, en el orden del Requirement
 * 6.5, listos para un `p-select` u otro control de selección.
 */
export const CHARGE_TYPE_OPTIONS: readonly ChargeTypeOption[] = (
  Object.keys(CHARGE_TYPE_LABELS) as ChargeType[]
).map((value) => ({ value, label: CHARGE_TYPE_LABELS[value] }));
