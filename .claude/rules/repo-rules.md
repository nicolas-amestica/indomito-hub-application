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
- El sistema de iconos de este repo es Iconify/Tabler, con clases `icon-[tabler--nombre]` más un tamaño explícito (`size-4` en botones con etiqueta, `size-5` en icon-only). PrimeIcons está prohibido aquí: el paquete no está instalado, el CSS compilado no contiene ninguna regla `.pi-*` y toda clase `pi pi-*` es inerte — el síntoma típico es un botón icon-only completamente en blanco. No usar `pi` ni en plantillas, ni en el input `icon` de un componente, ni en constantes, mapas de menú o datos. `npm run check:buttons` (regla R7) lo verifica de forma automática.
- Al agregar un icono, verificar que el nombre existe de verdad en el set instalado (`file-pdf` no existe: el correcto es `file-type-pdf`; `check-circle` tampoco: es `circle-check`) y comprobar en el CSS emitido que la clase se generó, no solo que está escrita en la plantilla. Los botones icon-only requieren `ariaLabel`/`aria-label` y los iconos decorativos dentro de un botón con etiqueta van con `aria-hidden="true"`; no usar `pButtonIcon` sin un `pButtonLabel` hermano, porque la directiva infiere icon-only y colapsa el ancho del botón. Mecánica detallada en `docs/standards/frontend/design-system-usage.md`.
- Las capacidades públicas de consulta y pago pertenecen exclusivamente a `app-ngx-pay`.
- TSDoc en español para funciones públicas e interfaces.
- Plantillas con `@if`, `@for` y `@switch`.

## Scopes de commits

`core`, `app-auth`, `accounting`, `analytics`, `assign-installment`, `shared`, `client`, `configuration`, `documents`, `help`, `home`, `inbox`, `informative-media`, `layout`, `meet`, `passenger`, `payment`, `payment-history`, `profile`, `program`, `ticket`, `tools`

## Diseño de formularios y páginas

Antes de modificar UI, leer `docs/standards/frontend/design-system-usage.md` y `docs/standards/frontend/ui-patterns.md` en el orquestador. Reutilizar el preset, los tokens y los componentes compartidos del propio repositorio.
