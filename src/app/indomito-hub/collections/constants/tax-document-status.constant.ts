import type { TaxDocumentStatus } from '../interfaces/tax-document.interface';

export type TaxDocumentStatusPresentation = Readonly<{
  label: string;
  severity: 'secondary' | 'info' | 'warn' | 'success' | 'danger';
}>;

export const TAX_DOCUMENT_STATUS_PRESENTATION: Readonly<
  Record<string, TaxDocumentStatusPresentation>
> = {
  PENDING_MANUAL_ISSUE: { label: 'Pendiente de emisión manual', severity: 'info' },
  MANUAL_RECORDED: { label: 'Registrada manualmente', severity: 'success' },
  READY: { label: 'Lista para emitir', severity: 'info' },
  ISSUING: { label: 'Emitiendo', severity: 'warn' },
  SUBMITTED: { label: 'Enviada al SII', severity: 'info' },
  ACCEPTED: { label: 'Aceptada', severity: 'success' },
  ACCEPTED_WITH_REPAIRS: { label: 'Aceptada con reparos', severity: 'warn' },
  REJECTED: { label: 'Rechazada', severity: 'danger' },
} as const satisfies Record<TaxDocumentStatus, TaxDocumentStatusPresentation>;
