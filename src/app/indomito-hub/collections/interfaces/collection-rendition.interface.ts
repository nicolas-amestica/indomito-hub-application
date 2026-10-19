/** Resumen de una rendición autenticada, sin datos bancarios personales. */
export interface CollectionRendition {
  id: string;
  providerId: number;
  receivedAt: string;
  status: string;
  processed: number;
  total: number;
  applied: number;
  observed: number;
  review: number;
  retries: number;
  lastError?: string;
  policy: { mode: 'OBSERVE' | 'APPLY'; revision: string };
}

/** Resultado del cruce de un pago con una rendición. */
export interface CollectionRenditionItem {
  paymentId: string;
  tripId?: string;
  status: string;
  gross: number;
  fee: number;
  feeScheme?: string;
  feeTreatment?: string;
  renditionDate: string;
}

/** Página acotada por cursor, con cabecera opcional del detalle. */
export interface CollectionRenditionPage<T> {
  rendition?: CollectionRendition;
  items: T[];
  nextCursor?: string;
}
