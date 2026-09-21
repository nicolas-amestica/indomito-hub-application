/**
 * Configuracion global del entorno de pruebas de Vitest.
 *
 * Se ejecuta una vez antes de cada archivo de test (ver `setupFiles` en
 * `angular.json`). Fija el minimo de iteraciones por defecto para los tests
 * de propiedad con `fast-check`, segun la estrategia de testing del diseño
 * de `program-form` (`numRuns: 100`).
 */
import fc from 'fast-check';

fc.configureGlobal({ numRuns: 100 });
