/**
 * Generadores de los parámetros de precio y del snapshot de tipo de cambio.
 *
 * Las tasas efectivas se generan **derivadas** del snapshot y de los incrementos,
 * nunca sueltas. Una tasa efectiva que no sea `tasa del día + incremento` no es
 * un caso que el sistema pueda producir (Requirement 4.6), y una propiedad que
 * falle solo con esa entrada estaría reportando un defecto inexistente.
 */

import fc from 'fast-check';
import { FIELD_LIMITS } from '../../constants/field-limits';
import type { EffectiveRates, ExchangeSnapshot } from '../../interfaces/program.interface';
import type { PricingInput } from '../calculation.types';
import { arbBoundedInt, arbLimitInt, arbSteppedInt } from './primitives';
import { arbStartDate } from './schedule.arbitrary';

/** Un snapshot con los incrementos que lo acompañan y las tasas que ambos producen. */
export interface PricingSample {
  pricing: PricingInput;
  exchange: ExchangeSnapshot;
  rates: EffectiveRates;
}

/** Rango plausible de la tasa del USD en CLP. Entera, según el Requirement 14.3. */
const USD_RATE_RANGE = { min: 1, max: 2000 } as const;

/** Rango plausible de la tasa del BRL en CLP. Entera, según el Requirement 14.3. */
const BRL_RATE_RANGE = { min: 1, max: 500 } as const;

/**
 * Parámetros de precio. Alcanza los incrementos en 0 y en su máximo, y la
 * utilidad y el recargo en 0 y en 100. Los dos incrementos se generan como
 * múltiplos de su paso, que es lo único que el control del formulario permite
 * elegir.
 */
export function arbPricing(): fc.Arbitrary<PricingInput> {
  return fc.record({
    usdIncreaseCLP: arbSteppedInt(FIELD_LIMITS.usdIncreaseCLP),
    brlIncreaseCLP: arbSteppedInt(FIELD_LIMITS.brlIncreaseCLP),
    utilityRate: arbLimitInt(FIELD_LIMITS.utilityRate),
    rechargeRate: arbLimitInt(FIELD_LIMITS.rechargeRate),
  });
}

/**
 * Snapshot de tipo de cambio. Genera `isFallback` en ambos valores porque la
 * marca no altera el cálculo pero sí lo que la interfaz muestra
 * (Requirement 1.7).
 */
export function arbExchangeSnapshot(): fc.Arbitrary<ExchangeSnapshot> {
  return fc.record({
    date: arbStartDate(),
    usdToClp: arbBoundedInt(USD_RATE_RANGE.min, USD_RATE_RANGE.max),
    brlToClp: arbBoundedInt(BRL_RATE_RANGE.min, BRL_RATE_RANGE.max),
    source: fc.constantFrom('banco-central' as const, 'currency-api' as const),
    isFallback: fc.boolean(),
  });
}

/** Tasas efectivas derivadas: tasa del día más incremento, con el CLP fijo en 1. */
export function buildRates(pricing: PricingInput, exchange: ExchangeSnapshot): EffectiveRates {
  return {
    CLP: 1,
    USD: exchange.usdToClp + pricing.usdIncreaseCLP,
    BRL: exchange.brlToClp + pricing.brlIncreaseCLP,
  };
}

/** Parámetros de precio, snapshot y tasas efectivas, los tres coherentes entre sí. */
export function arbPricingSample(): fc.Arbitrary<PricingSample> {
  return fc
    .tuple(arbPricing(), arbExchangeSnapshot())
    .map(([pricing, exchange]) => ({ pricing, exchange, rates: buildRates(pricing, exchange) }));
}

/** Solo las tasas efectivas, cuando la propiedad no necesita de dónde salieron. */
export function arbEffectiveRates(): fc.Arbitrary<EffectiveRates> {
  return arbPricingSample().map((sample) => sample.rates);
}
