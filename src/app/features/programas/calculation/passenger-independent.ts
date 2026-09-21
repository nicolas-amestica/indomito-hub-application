import type { ChargeableItem } from './charge-type';
import { isCrewItem } from './charge-type';

/**
 * Indica si el costo de un ítem no cambia con la cantidad de pasajeros.
 *
 * La regla fue validada por el usuario solicitante el 14 de septiembre de 2026:
 * incluye tripulación y servicios `fixed` y `per_day`. Es una corrección
 * deliberada respecto del legacy, que solo incluía los servicios `fixed`.
 */
export function isPassengerIndependent(item: ChargeableItem): boolean {
  if (isCrewItem(item)) return true;
  return item.chargeType === 'fixed' || item.chargeType === 'per_day';
}
