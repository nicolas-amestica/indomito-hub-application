/**
 * Contrato de favoritos (Requirement 11). Un favorito es el único mecanismo de
 * persistencia de esta feature: guarda el contenido de un `Program` con nombre,
 * pero **por tipo** omite lo que nunca debe recuperarse tal cual (Requirement
 * 11.16, 11.17).
 */

import type {
  CrewMember,
  ProgramGeneral,
  ProgramPricing,
  ProgramSchedule,
  ProgramService,
} from './program.interface';

/** Colección reutilizable que identifica favoritos de programa. */
export type FavoriteScope = 'programa';

/** Favorito. `content` es el programa sin totales ni snapshot de tipo de cambio. */
export interface Favorite {
  id: string;
  name: string;
  scope: FavoriteScope;
  content: FavoriteContent;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contenido guardado de un favorito. Omite `totals` y el snapshot de tipo de
 * cambio a propósito (Requirement 11.17): al cargar un favorito los montos se
 * recalculan con la tasa vigente (Requirement 11.10), así que guardar la tasa
 * histórica solo permitiría usarla por error.
 *
 * La exclusión es **por tipo, no por convención**: `totals` no existe como
 * propiedad de nivel superior (en vez de omitirla de `Program` con `Omit`,
 * `FavoriteContent` simplemente no la declara), y `exchange` se excluye dentro
 * de `pricing` con `Omit<ProgramPricing, 'exchange'>`, en el mismo nivel de
 * anidamiento en el que vive dentro de `Program` (`pricing.exchange`). Un
 * `Program` completo no es asignable a `FavoriteContent` en un contexto de
 * objeto literal ni viceversa sin pasar por esta forma explícita.
 *
 * `totalNights` sí se guarda dentro de `schedule`, porque es una decisión del
 * usuario y no un derivado del snapshot.
 */
export interface FavoriteContent {
  generals: ProgramGeneral;
  schedule: Pick<
    ProgramSchedule,
    'startDate' | 'endDate' | 'totalNights' | 'totalPassengers' | 'freePassengers'
  >;
  pricing: Omit<ProgramPricing, 'exchange'>;
  crews: Pick<CrewMember, 'name' | 'documentId' | 'dailyPrice' | 'currency'>[];
  services: Pick<ProgramService, 'name' | 'chargeType' | 'unitPrice' | 'currency'>[];
}

/** Cuerpo compartido por la creación y la actualización de un favorito. */
export interface FavoriteUpsertRequest {
  name: string;
  content: FavoriteContent;
}
