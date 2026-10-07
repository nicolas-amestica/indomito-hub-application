<!-- AUTO-GENERATED — DO NOT EDIT MANUALLY -->
<!-- Managed-By: indomito-context-compiler -->
<!-- Artifact-Format: 1 -->
<!-- Engine-Version: 1.0.0 -->
<!-- Source: ai/source/repo-overrides/app-ngx-hub.md -->
# Repo Rules — app-ngx-hub

# Repo Override — app-ngx-hub

> Contexto específico del frontend administrativo Angular de Indómito Hub.

## Descripción

SPA Angular 22 autenticada para la gestión de viajes, cotizaciones, contratos, pasajeros, cobranza y tesorería. No contiene ni publica el portal público de pagos.

## Stack

- Angular 22 con componentes standalone, signals e `inject()`
- PrimeNG v22 y TailwindCSS v4.3
- TypeScript 6 y Vitest

## Reglas

- Standalone components y `ChangeDetectionStrategy.OnPush`.
- Angular Signals para estado reactivo.
- PrimeNG para controles y Tailwind para composición, respetando los estándares visuales.
- Las capacidades públicas de consulta y pago pertenecen exclusivamente a `app-ngx-pay`.
- TSDoc en español para funciones públicas e interfaces.
- Plantillas con `@if`, `@for` y `@switch`.

## Scopes de commits

`core`, `app-auth`, `accounting`, `analytics`, `assign-installment`, `shared`, `client`, `configuration`, `documents`, `help`, `home`, `inbox`, `informative-media`, `layout`, `meet`, `passenger`, `payment`, `payment-history`, `profile`, `program`, `ticket`, `tools`

## Diseño de formularios y páginas

Antes de modificar UI, leer `docs/standards/frontend/design-system-usage.md` y `docs/standards/frontend/ui-patterns.md` en el orquestador. Reutilizar el preset, los tokens y los componentes compartidos del propio repositorio.
