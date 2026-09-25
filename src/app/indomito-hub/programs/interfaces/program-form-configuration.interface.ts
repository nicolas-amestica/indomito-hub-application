import type { CatalogResponse, MarginDefaults } from './catalog.interface';

/** Valores configurables que se aplican al iniciar Crear Programa. */
export interface ProgramFormConfiguration {
  catalogs: CatalogResponse;
  defaults: {
    generals: {
      defaultPlanId: string | null;
    };
    pricing: Omit<MarginDefaults, 'minUtilityRate'>;
  };
  policy: {
    minUtilityRate: number;
  };
  scenarioOffsets: number[];
}
