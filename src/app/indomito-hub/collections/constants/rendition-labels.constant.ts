/** Etiquetas de estados del procesamiento de rendiciones. */
export const RENDITION_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente de procesamiento',
  OBSERVED: 'Observado, sin modificar caja',
  COMPLETED: 'Procesado',
  REVIEW_REQUIRED: 'Requiere revisión',
  APPLIED: 'Aplicado a caja',
  UNKNOWN_ATTEMPT: 'Intento no identificado',
  PAYMENT_MISMATCH: 'El pago no coincide',
  ALREADY_SETTLED_REVIEW: 'Ya conciliado; revisar coincidencia',
  AMOUNT_MISMATCH: 'Diferencia de monto',
  INTEGRATOR_FEE_REVIEW: 'Comisión de integrador por revisar',
  FEE_SCHEME_REVIEW: 'Esquema de comisión por validar',
  DATE_REVIEW: 'Fecha por revisar',
  PAYMENT_RESOLVED_REVIEW: 'Pago revertido o resuelto; revisar',
  MISSING_PAYMENT_REVIEW: 'Pago no encontrado después de los reintentos',
};
