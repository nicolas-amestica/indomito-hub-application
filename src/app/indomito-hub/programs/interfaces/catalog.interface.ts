/**
 * Opciones de negocio incluidas en la configuración PGR. `CatalogRef` (la
 * referencia liviana que usa `Program`) vive en `program.interface.ts`.
 */

/** Opción de catálogo (plan o temporada). */
export interface CatalogOption {
  id: string;
  display: string;
  order: number;
}

/** Opción de destino. Además selecciona el generador de PDF del backend. */
export interface DestinationOption extends CatalogOption {
  /** Selecciona el generador de documento del backend. */
  budgetTemplateId: string;
}

/** Valores de margen reutilizados por la configuración del formulario. */
export interface MarginDefaults {
  usdIncreaseCLP: number;
  brlIncreaseCLP: number;
  utilityRate: number;
  rechargeRate: number;
  minUtilityRate: number;
}

/** Combinación opcional usada por generadores y pruebas de precarga. */
export interface CatalogSettings {
  defaultPlanId?: string;
  margin?: MarginDefaults;
  scenarioOffsets?: number[];
}

/** Catálogos exclusivos del formulario Crear Programa. */
export interface CatalogResponse {
  plans: CatalogOption[];
  seasons: CatalogOption[];
  destinations: DestinationOption[];
}
