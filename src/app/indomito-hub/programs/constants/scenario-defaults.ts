/**
 * Valores por defecto de los escenarios del presupuesto. Se usan cuando el
 * catálogo no declara sus propios valores (Requirement 13.3) y para acotar la
 * cantidad de escenarios que acepta el endpoint (Requirement 13.11).
 */

/** Desplazamientos de pasajeros por defecto, si el catálogo no los declara. Requirement 13.3. */
export const DEFAULT_SCENARIO_OFFSETS = [-10, -5, 0, 5] as const;

/** Cantidad máxima de escenarios que acepta el Budget_Pdf_Endpoint. Requirement 13.11. */
export const MAX_SCENARIOS = 4;
