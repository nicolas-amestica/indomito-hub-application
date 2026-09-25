import type { MarginDefaults } from './catalog.interface';

/** Valores configurables que se aplican al iniciar Crear Programa. */
export interface ProgramFormConfiguration {
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
