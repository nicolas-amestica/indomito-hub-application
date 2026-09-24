/**
 * Contrato de respuesta de `GET /tasas-cambio` (Requirement 14.2). La forma del
 * dato es idéntica a `ExchangeSnapshot` de `program.interface.ts`: ese tipo ES la
 * respuesta del endpoint, antes de guardarse dentro de `ProgramPricing.exchange`.
 * Se re-exporta acá con su nombre de dominio de API para que
 * `exchange-rate.service.ts` no dependa de `program.interface.ts` para tipar la
 * respuesta HTTP.
 */

import type { ExchangeSnapshot } from './program.interface';

export type { ExchangeSnapshot };

/** Cuerpo de datos (`data`) de la respuesta de `GET /tasas-cambio`. */
export type ExchangeRateResponse = ExchangeSnapshot;
