import { Pipe, type PipeTransform } from '@angular/core';

import { formatCLP } from './clp.formatter';

/**
 * Presenta cualquier monto calculado en CLP como entero con formato chileno.
 *
 * Las filas conservan su precisión para que el neto se calcule sin pérdidas;
 * el redondeo ocurre aquí únicamente para cumplir la representación visual del
 * Requirement 9.7.
 */
@Pipe({
  name: 'clpAmount',
})
export class ClpAmountPipe implements PipeTransform {
  transform(amount: number): string {
    return formatCLP(Math.round(amount));
  }
}
