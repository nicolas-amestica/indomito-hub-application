import type {
  ReceivedTaxDocument,
  ReceivedTaxResult,
} from '../interfaces/received-tax-document.interface';

export function receivedTaxRestriction(
  document: ReceivedTaxDocument | null,
  result: ReceivedTaxResult | null,
): string {
  if (document?.paymentForm === 1)
    return 'Pago al contado: no corresponde registrar acuse, aceptación ni reclamo en el SII.';
  if (document?.paymentForm === 3)
    return 'Entrega gratuita (sin costo): no corresponde registrar acuse, aceptación ni reclamo en el SII.';
  if (result?.code === 27 || document?.registry?.code === 27)
    return 'El SII informa pago al contado o entrega gratuita: no corresponde registrar acuse, aceptación ni reclamo.';
  return '';
}
