/**
 * Contrato de favoritos (Requirement 11). Un favorito es el único mecanismo de
 * persistencia de esta feature: guarda el contenido de un `Program` con nombre,
 * pero **por tipo** omite lo que nunca debe recuperarse tal cual (Requirement
 * 11.16, 11.17).
 */

import type {
  CrewMember,
  ExchangeRateOrigin,
  ProgramGeneral,
  ProgramPricing,
  ProgramSchedule,
  ProgramService,
  ProgramTotals,
} from './program.interface';

/** Colección reutilizable que identifica favoritos de programa. */
export type FavoriteScope = 'cotizacion';

/** Favorito con el precio y el snapshot de tipo de cambio aceptados. */
export interface Favorite {
  id: string;
  name: string;
  scope: FavoriteScope;
  content: FavoriteContent;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contenido guardado de un favorito. Los nuevos favoritos conservan la tasa
 * histórica para que un contrato respete el precio aceptado por el cliente.
 * `exchange` sigue siendo opcional por compatibilidad con favoritos antiguos.
 *
 * `totalNights` sí se guarda dentro de `schedule`, porque es una decisión del
 * usuario y no un derivado del snapshot.
 */
export interface FavoriteContent {
  generals: ProgramGeneral;
  schedule: Pick<
    ProgramSchedule,
    'totalDays' | 'totalNights' | 'totalPassengers' | 'freePassengers'
  >;
  pricing: Omit<ProgramPricing, 'exchange'> & { exchange?: ProgramPricing['exchange'] };
  /** Auditoría resumida mantenida por compatibilidad. */
  rateOrigin?: ExchangeRateOrigin;
  /** Totales y porcentajes efectivos usados al guardar el programa. */
  totals?: ProgramTotals;
  crews: Pick<CrewMember, 'name' | 'documentId' | 'dailyPrice' | 'currency'>[];
  services: Pick<ProgramService, 'name' | 'chargeType' | 'unitPrice' | 'currency'>[];
}

/** Cuerpo compartido por la creación y la actualización de un favorito. */
export interface FavoriteUpsertRequest {
  name: string;
  content: FavoriteContent;
}
