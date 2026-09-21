import { defineConfig } from 'vitest/config';

/**
 * Configuracion base de Vitest para el builder `@angular/build:unit-test`.
 *
 * El builder descubre este archivo automaticamente (`runnerConfig: true` en
 * `angular.json`) y lo fusiona con la configuracion que genera para el
 * proyecto. Fija el entorno de DOM en `jsdom` de forma explicita.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
