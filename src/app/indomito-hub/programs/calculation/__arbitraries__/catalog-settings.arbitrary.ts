/**
 * Generadores de los parámetros de política de empresa que el catálogo sirve
 * (Requirement 16).
 *
 * Los dos campos de `CatalogSettings` son opcionales y su ausencia activa
 * respaldos distintos: la de `margin` deja los cuatro controles vacíos pero
 * obligatorios (Requirement 4.11), y la de `scenarioOffsets` activa los
 * desplazamientos por defecto (Requirement 13.3). El generador **omite la clave**
 * en vez de asignarle `undefined`, porque un campo ausente y un campo con valor
 * indefinido no son lo mismo para quien recorre el objeto.
 */

import fc from 'fast-check';
import { FIELD_LIMITS } from '../../constants/field-limits';
import type { CatalogSettings, MarginDefaults } from '../../interfaces/catalog.interface';
import { arbLimitInt, arbSteppedInt } from './primitives';
import { arbScenarioOffsets } from './scenarios.arbitrary';

/** Utilidad y piso, generados en la relación que interesa probar. */
interface UtilityPair {
  utilityRate: number;
  minUtilityRate: number;
}

/**
 * Utilidad por debajo del piso de política, incluido el caso de utilidad en 0.
 * Es la combinación que dispara la advertencia no bloqueante del Requirement 4.12.
 */
function arbUtilityBelowFloor(): fc.Arbitrary<UtilityPair> {
  const { max } = FIELD_LIMITS.utilityRate;
  return fc.oneof(
    // Utilidad en 0 con un piso cualquiera: el programa vendido al costo.
    {
      arbitrary: fc
        .integer({ min: 1, max })
        .map((minUtilityRate) => ({ utilityRate: 0, minUtilityRate })),
      weight: 2,
    },
    // Cualquier utilidad estrictamente menor que el piso.
    {
      arbitrary: fc
        .integer({ min: 1, max })
        .chain((minUtilityRate) =>
          fc
            .integer({ min: 0, max: minUtilityRate - 1 })
            .map((utilityRate) => ({ utilityRate, minUtilityRate })),
        ),
      weight: 3,
    },
  );
}

/** Utilidad igual al piso o por encima: el caso sin advertencia. */
function arbUtilityAtOrAboveFloor(): fc.Arbitrary<UtilityPair> {
  const { min, max } = FIELD_LIMITS.utilityRate;
  return fc
    .integer({ min, max })
    .chain((minUtilityRate) =>
      fc
        .integer({ min: minUtilityRate, max })
        .map((utilityRate) => ({ utilityRate, minUtilityRate })),
    );
}

/**
 * Valores por defecto de margen. Alcanza la utilidad en 0, la utilidad por debajo
 * del piso y la utilidad que lo cumple.
 */
export function arbMarginDefaults(): fc.Arbitrary<MarginDefaults> {
  return fc
    .oneof(
      { arbitrary: arbUtilityBelowFloor(), weight: 3 },
      { arbitrary: arbUtilityAtOrAboveFloor(), weight: 2 },
    )
    .chain((utility) =>
      fc.record({
        usdIncreaseCLP: arbSteppedInt(FIELD_LIMITS.usdIncreaseCLP),
        brlIncreaseCLP: arbSteppedInt(FIELD_LIMITS.brlIncreaseCLP),
        utilityRate: fc.constant(utility.utilityRate),
        rechargeRate: arbLimitInt(FIELD_LIMITS.rechargeRate),
        minUtilityRate: fc.constant(utility.minUtilityRate),
      }),
    );
}

/**
 * Parámetros del catálogo en las cuatro combinaciones de presencia y ausencia de
 * sus dos campos opcionales.
 */
export function arbCatalogSettings(): fc.Arbitrary<CatalogSettings> {
  return fc
    .tuple(
      fc.option(arbMarginDefaults(), { nil: undefined, freq: 2 }),
      fc.option(arbScenarioOffsets(), { nil: undefined, freq: 2 }),
    )
    .map(([margin, scenarioOffsets]) => {
      const settings: CatalogSettings = {};
      if (margin !== undefined) settings.margin = margin;
      if (scenarioOffsets !== undefined) settings.scenarioOffsets = scenarioOffsets;
      return settings;
    });
}
