/**
 * Contrato de respuesta de `GET /catalogos`. `CatalogRef` (la referencia liviana
 * que usa `Program`) vive en `program.interface.ts`; este archivo contiene las
 * formas de lista y de política de empresa que entrega el `Catalog_Endpoint`.
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

/** Valores por defecto de margen y piso de política, servidos por el catálogo. */
export interface MarginDefaults {
  usdIncreaseCLP: number;
  brlIncreaseCLP: number;
  utilityRate: number;
  rechargeRate: number;
  minUtilityRate: number;
}

/**
 * Parámetros de política de empresa que acompañan a los catálogos. Su ausencia
 * activa los respaldos definidos para cada precarga.
 */
export interface CatalogSettings {
  /** Plan que se preselecciona cuando el catálogo termina de cargar. */
  defaultPlanId?: string;
  margin?: MarginDefaults;
  /** Desplazamientos de pasajeros del presupuesto. Por defecto [-10, -5, 0, 5]. */
  scenarioOffsets?: number[];
}

/** Respuesta de `GET /catalogos`. */
export interface CatalogResponse {
  plans: CatalogOption[];
  seasons: CatalogOption[];
  destinations: DestinationOption[];
  settings: CatalogSettings;
}
